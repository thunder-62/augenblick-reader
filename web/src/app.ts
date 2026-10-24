/**
 * Zwei Ebenen: Übersicht → Artikel [R19]. Keine Dialoge, keine Modi, „Übersicht“ ist immer der Notausgang.
 */
import {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  type Article,
  type ArticleCard,
  type Edition,
  type Settings,
} from '@augenblick/shared';
import { fetchArticle, fetchEdition, fetchSettings } from './api.ts';
import { button, fitsIn, h, icons, measureBox, setButton } from './dom.ts';
import { setLocale, t, tOr, tp } from './i18n.ts';
import { packPages, pageForAnchor, paginate, type Page, type PageItem } from './paginate.ts';
import { applySettings, calibrateCharWidth, layoutKey } from './settings.ts';
import { loadState, markRead, readIds, saveState as storeState } from './state.ts';
import { endReading, trackPage } from './usage.ts';
import { onTap } from './tap.ts';
import { keepAwake } from './wakelock.ts';

const MAX_CARDS_PER_PAGE = 3;
const SETTINGS_REFRESH_MS = 15 * 60 * 1000;
const EDITION_REFRESH_MS = 5 * 60 * 1000;
const RETRY_MS = 30 * 1000;

/** Abstufungen einer Karte, falls sie bei großer Schrift allein nicht auf die Seite passt. */
type CardDetail = 'full' | 'short' | 'title';
const CARD_DETAILS: CardDetail[] = ['full', 'short', 'title'];

function firstSentence(text: string): string {
  const m = /^.+?[.!?](?=\s+\p{Lu})/u.exec(text);
  return m ? m[0] : text;
}

export type Preview = { settings: unknown; articleId?: string };

type View =
  | { kind: 'loading' }
  | { kind: 'overview'; page: number }
  | { kind: 'article'; article: Article | null; id: string; page: number; pages: Page[] };

export class App {
  private settings: Settings = DEFAULT_SETTINGS;
  private serverSettings: Settings = DEFAULT_SETTINGS;
  private edition: Edition | null = null;
  private editionFailed = false;
  private view: View = { kind: 'loading' };
  private overviewPages: ArticleCard[][] = [];
  private screen: HTMLElement | null = null;

  /**
   * `preview`: Vorschau im Admin-Bereich – Einstellungen kommen vom Admin-Bereich, nichts wird
   * gespeichert oder protokolliert.
   */
  constructor(
    private readonly root: HTMLElement,
    private readonly preview: Preview | null = null,
  ) {}

  async start(): Promise<void> {
    applySettings(this.settings);
    this.renderMessage(t('state.loading'));
    await this.loadSettings();
    await document.fonts?.ready;
    calibrateCharWidth();
    await this.loadEdition();

    if (this.preview) {
      window.addEventListener('message', (e: MessageEvent<unknown>) => {
        if (e.origin !== location.origin) return;
        const data = e.data as { type?: string; settings?: unknown };
        if (data?.type !== 'augenblick-preview') return;
        if (this.preview) this.preview.settings = data.settings;
        void this.refreshSettings(true);
      });
      // Dem Admin-Bereich melden, dass die Vorschau bereit ist – er schickt dann den aktuellen Entwurf.
      if (window.parent !== window)
        window.parent.postMessage({ type: 'augenblick-preview-ready' }, location.origin);
      if (this.preview.articleId) await this.openArticle(this.preview.articleId, -1);
      else this.showOverview(0);
      return;
    }

    const saved = loadState();
    if (saved.view === 'article' && saved.articleId)
      await this.openArticle(saved.articleId, saved.anchor ?? -1);
    else this.showOverview(saved.overviewPage ?? 0);

    setInterval(() => void this.refreshSettings(), SETTINGS_REFRESH_MS);
    setInterval(() => void this.refreshEdition(), EDITION_REFRESH_MS);
    // Zurück im Vordergrund (z. B. nach der Kalibrierung): Einstellungen und Ausgabe sofort neu laden.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      void this.refreshSettings();
      void this.refreshEdition();
    });
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => this.rerender(), 150);
    });
  }

  // --- Daten ---------------------------------------------------------------

  private async loadSettings(cachedOnly = false): Promise<void> {
    if (!cachedOnly) {
      try {
        this.serverSettings = await fetchSettings();
      } catch {
        // Standardwerte bleiben; nächster Versuch beim regelmäßigen Abruf.
      }
    }
    this.settings = this.preview
      ? sanitizeSettings(this.preview.settings, this.serverSettings)
      : this.serverSettings;
    setLocale(this.settings.locale);
    applySettings(this.settings);
  }

  private async refreshSettings(cachedOnly = false): Promise<void> {
    const before = layoutKey(this.settings) + this.settings.theme;
    await this.loadSettings(cachedOnly);
    if (layoutKey(this.settings) + this.settings.theme !== before) {
      await document.fonts?.ready;
      calibrateCharWidth();
      this.rerender();
    }
  }

  private async loadEdition(): Promise<void> {
    try {
      this.edition = await fetchEdition();
      this.editionFailed = false;
    } catch {
      this.editionFailed = true;
      setTimeout(() => void this.refreshEdition(), RETRY_MS);
    }
  }

  private async refreshEdition(): Promise<void> {
    const before = JSON.stringify(this.edition?.articles.map((a) => a.id) ?? null);
    const failedBefore = this.editionFailed;
    await this.loadEdition();
    const after = JSON.stringify(this.edition?.articles.map((a) => a.id) ?? null);
    const changed = before !== after || failedBefore !== this.editionFailed;
    if (changed && this.view.kind === 'overview') this.showOverview(this.view.page);
    else if (!this.edition?.articles.length && !this.editionFailed)
      setTimeout(() => void this.refreshEdition(), RETRY_MS);
  }

  /** In der Vorschau wird kein Lesezustand gespeichert. */
  private saveState(state: Parameters<typeof storeState>[0]): void {
    if (!this.preview) storeState(state);
  }

  private rerender(): void {
    const v = this.view;
    if (v.kind === 'overview') this.showOverview(v.page);
    else if (v.kind === 'article' && v.article) {
      const anchor = v.page === 0 ? -1 : (v.pages[v.page]?.anchor ?? -1);
      this.renderArticle(v.article, anchor);
    }
  }

  private mount(screen: HTMLElement): void {
    this.screen?.remove();
    this.screen = screen;
    this.root.append(screen);
  }

  private renderMessage(text: string): void {
    this.mount(h('main', { class: 'screen message' }, h('p', {}, text)));
  }

  // --- Übersicht -----------------------------------------------------------

  /** `focusId`: Seite mit diesem Artikel zeigen (Rückkehr aus dem Artikel). */
  private showOverview(page: number, focusId?: string): void {
    keepAwake(false);
    endReading();
    const cards = this.edition?.articles ?? [];
    const read = readIds();
    const date = new Intl.DateTimeFormat(this.settings.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
    const list = h('section', { class: 'cards', 'aria-label': date });
    const back = button(t('nav.back'), 'left', 'btn-back');
    const next = button(t('nav.next'), 'right', 'btn-next');
    const info = h('p', { class: 'pageinfo', 'aria-live': 'polite' });
    const screen = h(
      'main',
      { class: 'screen overview' },
      h(
        'header',
        { class: 'masthead' },
        h('h1', { class: 'date' }, date),
        h('span', { class: 'brand' }, t('app.name')),
      ),
      list,
      h('nav', { class: 'bar' }, back, info, next),
    );
    this.mount(screen);

    if (!cards.length) {
      list.append(
        h(
          'p',
          { class: 'notice' },
          t(this.editionFailed ? 'overview.unreachable' : 'overview.empty'),
        ),
      );
      setButton(back, t('nav.back'), 'left', { inactive: true });
      setButton(next, t('nav.next'), 'right', { inactive: true });
      this.view = { kind: 'overview', page: 0 };
      return;
    }

    const box = measureBox(list);
    // Passt eine Karte allein nicht, wird ihre Kurzfassung gekürzt statt abgeschnitten.
    const detail = new Map<string, CardDetail>();
    for (const c of cards) {
      const level = CARD_DETAILS.find((d) => {
        box.replaceChildren(this.card(c, read.has(c.id), d));
        return fitsIn(box);
      });
      detail.set(c.id, level ?? 'title');
    }
    const cardFor = (c: ArticleCard): HTMLButtonElement =>
      this.card(c, read.has(c.id), detail.get(c.id));
    this.overviewPages = packPages(cards, MAX_CARDS_PER_PAGE, (group) => {
      box.replaceChildren(...group.map(cardFor));
      return fitsIn(box);
    });
    box.remove();
    if (focusId) {
      const i = this.overviewPages.findIndex((p) => p.some((c) => c.id === focusId));
      if (i >= 0) page = i;
    }

    const total = this.overviewPages.length;
    const go = (p: number): void => {
      const current = Math.max(0, Math.min(total - 1, p));
      this.view = { kind: 'overview', page: current };
      this.saveState({ view: 'overview', overviewPage: current });
      const items = (this.overviewPages[current] ?? []).map((c) => {
        const el = cardFor(c);
        onTap(el, () => void this.openArticle(c.id, -1));
        return el;
      });
      list.replaceChildren(...items);
      info.textContent = t('pager.pageOf', { page: current + 1, total });
      setButton(back, t('nav.back'), 'left', { inactive: current === 0 });
      setButton(next, t('nav.next'), 'right', { inactive: current >= total - 1 });
    };
    onTap(back, () => go((this.view.kind === 'overview' ? this.view.page : 0) - 1));
    onTap(next, () => go((this.view.kind === 'overview' ? this.view.page : 0) + 1));
    go(page);
  }

  private card(c: ArticleCard, isRead: boolean, detail: CardDetail = 'full'): HTMLButtonElement {
    const summary =
      detail === 'full'
        ? c.summary
        : detail === 'short'
          ? firstSentence(c.summary ?? '')
          : undefined;
    const rubric = `${tOr(`sections.${c.section ?? 'nachrichten'}`, 'sections.nachrichten')} · ${tOr(`sources.${c.source}`, 'sources.demo')}`;
    return h(
      'button',
      { type: 'button', class: `card${isRead ? ' is-read' : ''}`, lang: c.lang, 'data-id': c.id },
      h(
        'span',
        { class: 'rubric' },
        h('span', {}, rubric),
        isRead
          ? h(
              'span',
              { class: 'read' },
              icons.check(),
              h('span', { class: 'sr-only' }, t('card.read')),
            )
          : null,
      ),
      h('span', { class: 'title' }, c.title),
      summary
        ? h('span', { class: c.summaryAi ? 'summary summary-ai' : 'summary' }, App.glue(summary))
        : null,
      h('span', { class: 'time' }, tp('card.readingTime', c.readingMinutes)),
    );
  }

  // --- Artikel -------------------------------------------------------------

  private async openArticle(id: string, anchor: number): Promise<void> {
    let article: Article | null;
    try {
      article = await fetchArticle(id);
    } catch {
      article = null;
    }
    if (!article) {
      this.renderMissingArticle(id);
      return;
    }
    if (!this.preview) markRead(article.id);
    this.renderArticle(article, anchor);
  }

  private renderMissingArticle(id: string): void {
    keepAwake(false);
    const overview = button(t('nav.overview'), 'left', 'btn-overview');
    onTap(overview, () => this.showOverview(0, id));
    const back = button(t('nav.back'), 'left', 'btn-back');
    const next = button(t('nav.next'), 'right', 'btn-next');
    setButton(back, t('nav.back'), 'left', { inactive: true });
    setButton(next, t('nav.next'), 'right', { inactive: true });
    this.mount(
      h(
        'main',
        { class: 'screen article' },
        h('div', { class: 'rail' }, overview),
        h('article', { class: 'page' }, h('p', { class: 'notice' }, t('article.notFound'))),
        h('nav', { class: 'bar' }, back, h('p', { class: 'pageinfo' }), next),
      ),
    );
    this.view = { kind: 'article', article: null, id, page: 0, pages: [] };
    this.saveState({ view: 'overview', overviewPage: 0 });
  }

  private renderArticle(article: Article, anchor: number): void {
    keepAwake(true);
    const overview = button(t('nav.overview'), 'left', 'btn-overview');
    const back = button(t('nav.back'), 'left', 'btn-back');
    const next = button(t('nav.next'), 'right', 'btn-next');
    const info = h('p', { class: 'pageinfo', 'aria-live': 'polite' });
    const pageEl = h('article', { class: 'page prose', lang: article.lang });
    this.mount(
      h(
        'main',
        { class: 'screen article' },
        h('div', { class: 'rail' }, overview),
        pageEl,
        h('nav', { class: 'bar' }, back, info, next),
      ),
    );

    const offsets: number[] = [];
    let count = 0;
    for (const b of article.blocks) {
      offsets.push(count);
      if (b.type === 'paragraph') count += b.sentences.length;
    }
    const box = measureBox(pageEl);
    const pages = paginate(article.blocks, (items) => {
      box.replaceChildren(...this.renderItems(article, items, offsets));
      return fitsIn(box);
    });
    box.remove();

    const nextCard = this.nextInEdition(article.id);
    const total = pages.length;
    const go = (p: number): void => {
      const current = Math.max(0, Math.min(total - 1, p));
      this.view = { kind: 'article', article, id: article.id, page: current, pages };
      // Seite 1 als -1 merken: sie beginnt mit dem Titel, auch wenn der erste Satz erst auf Seite 2 steht.
      this.saveState({
        view: 'article',
        articleId: article.id,
        anchor: current === 0 ? -1 : (pages[current]?.anchor ?? 0),
      });
      if (!this.preview) trackPage(article.id, current, total);
      pageEl.replaceChildren(...this.renderItems(article, pages[current]?.items ?? [], offsets));
      info.textContent = t('pager.pageOf', { page: current + 1, total });
      setButton(back, t('nav.back'), 'left', { inactive: current === 0 });
      const last = current >= total - 1;
      if (last && nextCard) setButton(next, t('nav.nextArticle'), 'right', { sub: nextCard.title });
      else setButton(next, t('nav.next'), 'right', { inactive: last });
      next.classList.toggle('btn-next-article', last && Boolean(nextCard));
    };
    onTap(overview, () => this.showOverview(0, article.id));
    onTap(back, () => {
      if (this.view.kind === 'article') go(this.view.page - 1);
    });
    onTap(next, () => {
      if (this.view.kind !== 'article') return;
      if (this.view.page < total - 1) go(this.view.page + 1);
      else if (nextCard) void this.openArticle(nextCard.id, -1);
    });
    go(pageForAnchor(pages, anchor));
  }

  /** Typografie ohne Textänderung: „z. B.“, „u. a.“ nicht über Zeilen trennen. */
  private static glue(text: string): string {
    return text.replace(/(?<=(?:^|[\s(„"])\p{L}\.) (?=\p{L}\.)/gu, '\u00A0');
  }

  private renderItems(article: Article, items: PageItem[], offsets: number[]): HTMLElement[] {
    const out: HTMLElement[] = [];
    for (const it of items) {
      if (it.kind === 'head') {
        const meta = `${tOr(`sections.${article.section ?? 'nachrichten'}`, 'sections.nachrichten')} · ${t(
          'article.source',
          {
            source: tOr(`sources.${article.source}`, 'sources.demo'),
          },
        )}`;
        out.push(h('p', { class: 'meta' }, meta), h('h1', { class: 'title' }, article.title));
        continue;
      }
      const block = article.blocks[it.block];
      if (!block) continue;
      if (it.kind === 'heading' && block.type === 'heading') {
        out.push(h('h2', {}, block.text));
      } else if (it.kind === 'para' && block.type === 'paragraph') {
        const p = h('p', { class: it.from > 0 ? 'cont' : '' });
        block.sentences.slice(it.from, it.to).forEach((s, i) => {
          if (i > 0) p.append(' ');
          p.append(
            h(
              'span',
              { class: 's', 'data-s': (offsets[it.block] ?? 0) + it.from + i },
              App.glue(s),
            ),
          );
        });
        out.push(p);
      } else if (it.kind === 'words' && block.type === 'paragraph') {
        const words = (block.sentences[it.sentence] ?? '')
          .split(' ')
          .slice(it.from, it.to)
          .join(' ');
        out.push(
          h(
            'p',
            { class: it.from > 0 ? 'cont' : '' },
            h('span', { class: 's', 'data-s': (offsets[it.block] ?? 0) + it.sentence }, words),
          ),
        );
      }
    }
    return out;
  }

  private nextInEdition(id: string): ArticleCard | null {
    const list = this.edition?.articles ?? [];
    const i = list.findIndex((a) => a.id === id);
    return i >= 0 ? (list[i + 1] ?? null) : null;
  }
}
