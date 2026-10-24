import type { Config } from '../core/config.ts';
import { RssAdapter } from './br24.ts';
import { resolveFeeds } from './feeds.ts';
import { TagesschauAdapter } from './tagesschau.ts';
import type { SourceAdapter } from './types.ts';

/**
 * Die Adapter leben so lange wie der Worker (Ratenbegrenzung). Die Feed-Liste wird je Lauf
 * gelesen, damit Änderungen im Technik-Bereich ohne Neustart gelten (ADR 010).
 * Katalog-Feeds des BR laufen als Quelle „br24“, eigene Adressen als Quelle „rss“.
 */
export function createAdapters(
  config: Pick<Config, 'tagesschauBaseUrl' | 'tagesschauHourlyLimit' | 'rssFeeds'>,
  feeds: () => readonly string[] = () => config.rssFeeds,
): SourceAdapter[] {
  const bySource = (source: string) => () =>
    resolveFeeds(feeds()).filter((f) => f.source === source);
  return [
    new TagesschauAdapter({
      baseUrl: config.tagesschauBaseUrl,
      hourlyLimit: config.tagesschauHourlyLimit,
    }),
    new RssAdapter({ id: 'br24', feeds: bySource('br24') }),
    new RssAdapter({ id: 'rss', feeds: bySource('rss') }),
  ];
}
