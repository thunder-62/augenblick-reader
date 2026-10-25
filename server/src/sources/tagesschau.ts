/**
 * Adapter für die öffentliche JSON-Schnittstelle der tagesschau (ADR 001).
 * Nutzungsbedingungen: privater, nicht-kommerzieller Gebrauch; höchstens 60 Abrufe pro Stunde.
 */
import { getJson, type FetchLike } from '../core/http.ts';
import { RateLimiter } from '../core/ratelimit.ts';
import { toIso } from '../core/time.ts';
import type { RawArticle, RawItem, SourceAdapter } from './types.ts';

type ContentElement = { type?: string; value?: string };

export type TagesschauItem = {
  sophoraId?: string;
  externalId?: string;
  title?: string;
  topline?: string;
  date?: string;
  ressort?: string;
  regionId?: number | string;
  type?: string;
  details?: string;
  detailsweb?: string;
  shareURL?: string;
  firstSentence?: string;
  content?: ContentElement[];
};

type ListResponse = { news?: TagesschauItem[]; regional?: TagesschauItem[] };

const SECTION_MAP: Record<string, string> = {
  inland: 'inland',
  ausland: 'ausland',
  wirtschaft: 'wirtschaft',
  sport: 'sport',
  wissen: 'wissen',
  investigativ: 'inland',
};

export function tagesschauSection(item: TagesschauItem): string {
  const r = item.ressort?.toLowerCase();
  if (r && SECTION_MAP[r]) return SECTION_MAP[r];
  return 'nachrichten';
}

/**
 * Regionalmeldungen der Landesrundfunkanstalten (z. B. aus Norddeutschland) helfen der Leserin
 * nicht; Regionales kommt aus den BR24-Feeds (Wunsch des Betreuers, ADR 020).
 */
export function isRegional(item: TagesschauItem): boolean {
  const region = item.regionId;
  if (region === undefined || region === null || region === '' || region === 0 || region === '0')
    return false;
  return true;
}

/** Nur Text und Zwischenüberschriften übernehmen; Boxen, Zitat-Kästen, Medien, Links usw. entfallen. */
export function contentToHtml(content: ContentElement[]): string {
  const parts: string[] = [];
  for (const el of content) {
    if (!el.value) continue;
    if (el.type === 'text')
      parts.push(/^\s*<(p|h\d)\b/i.test(el.value) ? el.value : `<p>${el.value}</p>`);
    else if (el.type === 'headline')
      parts.push(/^\s*<h\d\b/i.test(el.value) ? el.value : `<h2>${el.value}</h2>`);
  }
  return parts.join('\n');
}

export type TagesschauOptions = {
  baseUrl: string;
  hourlyLimit: number;
  fetch?: FetchLike;
  /** Listen-Endpunkte relativ zu baseUrl. */
  lists?: string[];
  limiter?: RateLimiter;
};

export class TagesschauAdapter implements SourceAdapter {
  readonly id = 'tagesschau';
  private readonly limiter: RateLimiter;
  private readonly lists: string[];

  constructor(private readonly options: TagesschauOptions) {
    this.limiter = options.limiter ?? new RateLimiter(options.hourlyLimit, 60 * 60 * 1000);
    this.lists = options.lists ?? ['/homepage/', '/news/?ressort=sport', '/news/?ressort=wissen'];
  }

  private async get<T>(url: string): Promise<T> {
    if (!this.limiter.take())
      throw new Error('tagesschau: Abruf-Kontingent dieser Stunde erschöpft');
    return getJson<T>(url, this.options.fetch ? { fetch: this.options.fetch } : {});
  }

  async fetchList(): Promise<RawItem[]> {
    const seen = new Set<string>();
    const items: RawItem[] = [];
    let lastError: unknown = null;
    for (const path of this.lists) {
      let res: ListResponse;
      try {
        res = await this.get<ListResponse>(`${this.options.baseUrl}${path}`);
      } catch (err) {
        lastError = err;
        continue;
      }
      // Die Liste „regional“ wird nicht gelesen, Regionalmeldungen in „news“ übersprungen (ADR 020).
      for (const n of res.news ?? []) {
        const id = n.externalId ?? n.sophoraId;
        if (!id || seen.has(id) || !n.title) continue;
        if (n.type && n.type !== 'story') continue;
        if (isRegional(n)) continue;
        seen.add(id);
        items.push({
          id,
          url: n.shareURL ?? n.detailsweb ?? n.details ?? '',
          title: n.title,
          publishedAt: toIso(n.date) ?? new Date().toISOString(),
          section: tagesschauSection(n),
          payload: n,
        });
      }
    }
    if (!items.length && lastError) throw lastError;
    return items;
  }

  async fetchArticle(item: RawItem): Promise<RawArticle> {
    let data = item.payload as TagesschauItem | undefined;
    if (!data?.content?.length) {
      if (!data?.details)
        throw new Error(`tagesschau: kein Inhalt und keine Detail-URL für ${item.id}`);
      data = await this.get<TagesschauItem>(data.details);
    }
    return {
      originalId: item.id,
      sourceUrl: item.url,
      lang: 'de',
      ...(item.section ? { section: item.section } : {}),
      title: data.title ?? item.title,
      publishedAt: toIso(data.date) ?? item.publishedAt,
      html: contentToHtml(data.content ?? []),
      ...((data.firstSentence ?? (item.payload as TagesschauItem | undefined)?.firstSentence)
        ? { teaser: data.firstSentence ?? (item.payload as TagesschauItem).firstSentence }
        : {}),
    };
  }
}
