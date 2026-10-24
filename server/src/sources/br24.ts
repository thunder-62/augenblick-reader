/**
 * Adapter für BR24 (ADR 002): RSS-Feed für die Liste, Volltext von der Artikelseite,
 * bereinigt mit einer Readability-Extraktion.
 */
import { createHash } from 'node:crypto';
import { Readability } from '@mozilla/readability';
import { XMLParser } from 'fast-xml-parser';
import { parseHTML } from 'linkedom';
import { getText, type FetchLike } from '../core/http.ts';
import { normalizeWhitespace } from '../core/text.ts';
import { toIso } from '../core/time.ts';
import type { RawArticle, RawItem, SourceAdapter } from './types.ts';

type RssItem = {
  title?: string;
  link?: string;
  guid?: string | { '#text'?: string };
  pubDate?: string;
  category?: string | string[];
  description?: string;
};

function asText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && '#text' in v)
    return asText((v as { '#text': unknown })['#text']);
  return '';
}

/** RSS-Beschreibung (oft HTML) als Klartext. */
export function htmlToText(html: string): string {
  return normalizeWhitespace(
    parseHTML(`<!doctype html><html><body>${html}</body></html>`).document.body.textContent ?? '',
  );
}

export function br24Section(categories: string[]): string {
  return categories.some((c) => /sport|fußball|fussball|bundesliga/i.test(c)) ? 'sport' : 'region';
}

export function parseFeed(xml: string): RawItem[] {
  const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } };
  const raw = doc.rss?.channel?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const items: RawItem[] = [];
  for (const it of list) {
    const link = asText(it.link).trim();
    const title = asText(it.title).trim();
    if (!link || !title) continue;
    const guid = asText(it.guid).trim() || link;
    const categories = (
      Array.isArray(it.category) ? it.category : it.category ? [it.category] : []
    ).map(asText);
    items.push({
      id: createHash('sha1').update(guid).digest('hex').slice(0, 16),
      url: link,
      title,
      publishedAt: toIso(asText(it.pubDate)) ?? new Date().toISOString(),
      section: br24Section(categories),
      ...(it.description ? { payload: { teaser: htmlToText(asText(it.description)) } } : {}),
    });
  }
  return items;
}

/** Hauptinhalt einer Artikelseite als HTML. */
export function extractArticleHtml(
  pageHtml: string,
  url: string,
): { title: string | null; html: string } {
  const { document } = parseHTML(pageHtml);
  // Readability braucht eine Basis-URL für relative Links; ohne <base> genügt documentURI nicht immer.
  const result = new Readability(document as unknown as Document, { keepClasses: false }).parse();
  if (!result?.content) throw new Error(`br24: kein Artikeltext gefunden (${url})`);
  return { title: result.title ?? null, html: result.content };
}

/** `feedUrl` als Funktion, damit eine im Admin-Bereich geänderte Adresse ohne Neustart gilt. */
export type Br24Options = { feedUrl: string | (() => string); fetch?: FetchLike };

export class Br24Adapter implements SourceAdapter {
  readonly id = 'br24';

  constructor(private readonly options: Br24Options) {}

  private fetchOpts(): { fetch?: FetchLike } {
    return this.options.fetch ? { fetch: this.options.fetch } : {};
  }

  async fetchList(): Promise<RawItem[]> {
    const { feedUrl } = this.options;
    const xml = await getText(typeof feedUrl === 'function' ? feedUrl() : feedUrl, {
      ...this.fetchOpts(),
      accept: 'application/rss+xml, application/xml',
    });
    return parseFeed(xml);
  }

  async fetchArticle(item: RawItem): Promise<RawArticle> {
    const page = await getText(item.url, { ...this.fetchOpts(), accept: 'text/html' });
    const { html } = extractArticleHtml(page, item.url);
    return {
      originalId: item.id,
      sourceUrl: item.url,
      lang: 'de',
      ...(item.section ? { section: item.section } : {}),
      title: item.title,
      publishedAt: item.publishedAt,
      html,
      ...((item.payload as { teaser?: string } | undefined)?.teaser
        ? { teaser: (item.payload as { teaser: string }).teaser }
        : {}),
    };
  }
}
