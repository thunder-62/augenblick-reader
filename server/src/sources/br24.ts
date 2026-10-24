/**
 * RSS-Adapter (ADR 002, ADR 010): ein oder mehrere Feeds (RSS 2.0, RDF/RSS 1.0, Atom) für die
 * Liste, Volltext von der Artikelseite, bereinigt mit einer Readability-Extraktion.
 * Der Dateiname stammt aus M1, als es nur den BR24-Feed gab.
 */
import { createHash } from 'node:crypto';
import { Readability } from '@mozilla/readability';
import { XMLParser } from 'fast-xml-parser';
import { parseHTML } from 'linkedom';
import { getText, type FetchLike } from '../core/http.ts';
import { log } from '../core/log.ts';
import { normalizeWhitespace } from '../core/text.ts';
import { toIso } from '../core/time.ts';
import type { ResolvedFeed } from './feeds.ts';
import type { RawArticle, RawItem, SourceAdapter } from './types.ts';

type FeedEntry = Record<string, unknown>;

function asText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return asText(v[0]);
  if (v && typeof v === 'object' && '#text' in v)
    return asText((v as { '#text': unknown })['#text']);
  return '';
}

function asList<T>(v: T | T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

/** Atom: <link href="…" rel="alternate"/>; RSS/RDF: <link>…</link>. */
function linkOf(v: unknown): string {
  const links = asList(v as unknown);
  for (const l of links) {
    if (typeof l === 'string' && l.trim()) return l.trim();
    if (l && typeof l === 'object') {
      const o = l as Record<string, unknown>;
      const rel = typeof o['@_rel'] === 'string' ? o['@_rel'] : 'alternate';
      if (typeof o['@_href'] === 'string' && rel === 'alternate') return o['@_href'].trim();
      const t = asText(o).trim();
      if (t) return t;
    }
  }
  return '';
}

/** RSS-Beschreibung (oft HTML) als Klartext. */
export function htmlToText(html: string): string {
  return normalizeWhitespace(
    parseHTML(`<!doctype html><html><body>${html}</body></html>`).document.body.textContent ?? '',
  );
}

/** Sport-Kategorien kommen in die Rubrik „sport“, sonst gilt die Rubrik des Feeds. */
export function br24Section(categories: string[], fallback = 'region'): string {
  return categories.some((c) => /sport|fußball|fussball|bundesliga/i.test(c)) ? 'sport' : fallback;
}

/** Einträge aus RSS 2.0 (rss/channel/item), RDF (rdf:RDF/item) oder Atom (feed/entry). */
function entriesOf(doc: Record<string, unknown>): FeedEntry[] {
  const rss = doc.rss as { channel?: { item?: unknown } } | undefined;
  if (rss?.channel) return asList(rss.channel.item as FeedEntry | FeedEntry[]);
  const rdf = doc['rdf:RDF'] as { item?: unknown } | undefined;
  if (rdf) return asList(rdf.item as FeedEntry | FeedEntry[]);
  const atom = doc.feed as { entry?: unknown } | undefined;
  if (atom) return asList(atom.entry as FeedEntry | FeedEntry[]);
  return [];
}

export function parseFeed(xml: string, section = 'region'): RawItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const items: RawItem[] = [];
  for (const it of entriesOf(doc)) {
    const link =
      linkOf(it.link) || (typeof it['@_rdf:about'] === 'string' ? it['@_rdf:about'] : '');
    const title = htmlToText(asText(it.title));
    if (!link || !title) continue;
    const guid = asText(it.guid).trim() || asText(it.id).trim() || link;
    const categories = [
      ...asList(it.category as unknown).map((c) =>
        c && typeof c === 'object' && '@_term' in c
          ? asText((c as Record<string, unknown>)['@_term'])
          : asText(c),
      ),
      ...asList(it['dc:subject'] as unknown).map(asText),
    ];
    const date =
      asText(it.pubDate) || asText(it['dc:date']) || asText(it.published) || asText(it.updated);
    const description = asText(it.description) || asText(it.summary);
    items.push({
      id: createHash('sha1').update(guid).digest('hex').slice(0, 16),
      url: link,
      title,
      publishedAt: toIso(date) ?? new Date().toISOString(),
      section: br24Section(categories, section),
      ...(description ? { payload: { teaser: htmlToText(description) } } : {}),
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
  const result = new Readability(document as unknown as Document, { keepClasses: false }).parse();
  if (!result?.content) throw new Error(`kein Artikeltext gefunden (${url})`);
  return { title: result.title ?? null, html: result.content };
}

/**
 * `feeds` als Funktion, damit eine im Technik-Bereich geänderte Liste ohne Neustart gilt.
 * `id` ist die Quelle, unter der die Artikel gespeichert und angezeigt werden.
 */
export type RssOptions = {
  id: string;
  feeds: () => ResolvedFeed[];
  fetch?: FetchLike;
};

export class RssAdapter implements SourceAdapter {
  readonly id: string;

  constructor(private readonly options: RssOptions) {
    this.id = options.id;
  }

  private fetchOpts(): { fetch?: FetchLike } {
    return this.options.fetch ? { fetch: this.options.fetch } : {};
  }

  /** Alle Feeds nacheinander; einzelne Ausfälle stören die übrigen nicht. */
  async fetchList(): Promise<RawItem[]> {
    const feeds = this.options.feeds();
    const items: RawItem[] = [];
    const errors: unknown[] = [];
    for (const feed of feeds) {
      try {
        const xml = await getText(feed.url, {
          ...this.fetchOpts(),
          accept: 'application/rss+xml, application/rdf+xml, application/atom+xml, application/xml',
        });
        for (const item of parseFeed(xml, feed.section))
          if (!items.some((i) => i.id === item.id)) items.push(item);
      } catch (err) {
        errors.push(err);
        log.warn(
          `[${this.id}] Feed nicht abrufbar: ${feed.url} – ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (feeds.length && errors.length === feeds.length) throw errors[0];
    return items;
  }

  async fetchArticle(item: RawItem): Promise<RawArticle> {
    const page = await getText(item.url, { ...this.fetchOpts(), accept: 'text/html' });
    const { html } = extractArticleHtml(page, item.url);
    const teaser = (item.payload as { teaser?: string } | undefined)?.teaser;
    return {
      originalId: item.id,
      sourceUrl: item.url,
      lang: 'de',
      ...(item.section ? { section: item.section } : {}),
      title: item.title,
      publishedAt: item.publishedAt,
      html,
      ...(teaser ? { teaser } : {}),
    };
  }
}

/** Einzelner BR24-Feed (Schreibweise aus M1, für Tests und Abwärtskompatibilität). */
export class Br24Adapter extends RssAdapter {
  constructor(options: { feedUrl: string | (() => string); fetch?: FetchLike }) {
    const url = (): string =>
      typeof options.feedUrl === 'function' ? options.feedUrl() : options.feedUrl;
    super({
      id: 'br24',
      feeds: () => [{ key: url(), name: 'BR24', url: url(), source: 'br24', section: 'region' }],
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  }
}
