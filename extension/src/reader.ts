/**
 * Leseansicht von Augenblick für Firefox (SPEC §16.4): zeigt den Artikel mit dem gemeinsamen
 * Lese-Baustein (ADR 023), in F1 mit festen Standardwerten. Der Artikel kommt per Nachricht vom
 * Inhaltsskript; dargestellt wird nur über DOM-Bau, nie über `innerHTML`.
 */
import '@augenblick/web/reader.css';
import { sanitizeSettings, type Settings } from '@augenblick/shared';
import {
  applySettings,
  calibrateCharWidth,
  h,
  keepAwake,
  onTap,
  readingView,
  roundButton,
  setLocale,
  t,
} from '@augenblick/web/reader';
import { isToReader, type FromReader, type PageArticle } from './messages.ts';

const token = location.hash.slice(1);

/**
 * F1: feste Standardwerte. `?vorschau=<Einstellungen als JSON>` zeigt andere Werte, wie die
 * Vorschau der Web-App (für Tests aller Schriftstufen; das Inhaltsskript setzt es nie).
 */
function readerSettings(): Settings {
  const raw = new URLSearchParams(location.search).get('vorschau');
  try {
    return sanitizeSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeSettings({});
  }
}
const root = document.getElementById('app') as HTMLElement;

// Kein Kontextmenü bei langem Druck, keine Textauswahl (SPEC §8.1).
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => e.preventDefault());

const tell = (type: FromReader['type']): void => {
  const msg: FromReader = { type };
  // Ohne Geheimnis: das Inhaltsskript prüft Absender-Fenster und Herkunft.
  window.parent.postMessage(msg, '*');
};
const close = (): void => tell('augenblick:close');

function mount(screen: HTMLElement): void {
  root.replaceChildren(screen);
}

function showMessage(text: string, withBack: boolean): void {
  const screen = h('main', { class: 'screen message' }, h('p', { class: 'notice' }, text));
  if (withBack) {
    const back = roundButton(t('extension.toPage'), 'btn-to-page');
    onTap(back, close);
    screen.append(back);
  }
  mount(screen);
}

function show(article: PageArticle | null): void {
  if (!article) {
    keepAwake(false);
    showMessage(t('extension.failed'), true);
    return;
  }
  const view = readingView(
    { title: article.title, lang: article.lang, blocks: article.blocks, meta: article.site },
    {
      backLabel: t('extension.toPage'),
      backClass: 'btn-to-page',
      end: h('p', {}, t('article.end')),
      // Die Bilder der Seite, so wie sie sie geladen hat (ADR 024).
      imageAllowed: (src) => /^https?:\/\//.test(src),
    },
  );
  mount(view.screen);
  onTap(view.back, close);
  keepAwake(true);
}

async function start(): Promise<void> {
  setLocale('de');
  applySettings(readerSettings());
  showMessage(t('extension.loading'), true);
  await document.fonts?.ready;
  calibrateCharWidth();
  let shown = false;
  window.addEventListener('message', (e) => {
    // Nur das eigene Inhaltsskript kennt das Kennwort aus der Adresse.
    if (shown || e.source !== window.parent || !isToReader(e.data) || e.data.token !== token)
      return;
    shown = true;
    show(e.data.article);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  tell('augenblick:ready');
}

void start();
