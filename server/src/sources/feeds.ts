/** Auflösen und Prüfen der konfigurierten RSS-Feeds (ADR 010). */
import { FEED_CATALOG, MAX_FEEDS } from '@augenblick/shared';

export type ResolvedFeed = {
  /** Eintrag aus der Konfiguration (Kurzname oder Adresse). */
  key: string;
  name: string;
  url: string;
  source: string;
  section: string;
};

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Kurzname aus dem Katalog oder eigene Adresse; eigene Adressen laufen als Quelle „rss“. */
export function resolveFeed(entry: string): ResolvedFeed | null {
  const key = entry.trim();
  const known = FEED_CATALOG.find((f) => f.id === key || f.url === key);
  if (known)
    return {
      key: known.id,
      name: known.name,
      url: known.url,
      source: known.source,
      section: known.section,
    };
  if (!isHttpUrl(key)) return null;
  return { key, name: new URL(key).hostname, url: key, source: 'rss', section: 'nachrichten' };
}

export function resolveFeeds(entries: readonly string[]): ResolvedFeed[] {
  const out: ResolvedFeed[] = [];
  for (const e of entries) {
    const f = resolveFeed(e);
    if (f && !out.some((o) => o.url === f.url)) out.push(f);
  }
  return out;
}

/**
 * Prüft eine Feed-Liste aus Technik-Bereich oder Umgebung: Kurznamen oder http(s)-Adressen,
 * ohne Doppelte, höchstens MAX_FEEDS. Wirft bei ungültigen Einträgen.
 */
export function normalizeFeedList(input: unknown): string[] {
  if (!Array.isArray(input)) throw new Error('Die Feeds müssen als Liste angegeben werden.');
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') throw new Error('Ungültiger Feed-Eintrag.');
    const entry = raw.trim();
    if (!entry) continue;
    const f = resolveFeed(entry);
    if (!f)
      throw new Error(
        `„${entry}“ ist weder ein bekannter Feed noch eine Adresse mit http:// oder https://.`,
      );
    if (!out.includes(f.key)) out.push(f.key);
  }
  if (out.length > MAX_FEEDS) throw new Error(`Höchstens ${MAX_FEEDS} Feeds.`);
  return out;
}
