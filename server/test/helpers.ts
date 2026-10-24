import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS, type Article, type Block } from '@augenblick/shared';
import type { AppConfig } from '../src/app.ts';
import { DEFAULT_TECHNIK_NETWORKS } from '../src/core/network.ts';
import type { FetchLike } from '../src/core/http.ts';

export const fixture = (name: string): string =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

/** Fake-fetch: URL → Antworttext; unbekannte URLs ergeben 404. */
export function fakeFetch(routes: Record<string, string>, calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    const body = routes[url];
    return body === undefined
      ? new Response('nicht gefunden', { status: 404 })
      : new Response(body, { status: 200 });
  };
}

let counter = 0;

export function makeArticle(over: Partial<Article> & { text?: string } = {}): Article {
  counter++;
  const text =
    over.text ??
    `Dies ist ein selbst geschriebener Beispielartikel Nummer ${counter}. Er handelt von einem erfundenen Ereignis in einer erfundenen Stadt. Die Sätze sind nur für Tests gedacht und sagen nichts Wichtiges. Trotzdem braucht er genug Wörter, damit er als fertig gilt. Deshalb steht hier noch ein weiterer Satz mit ein paar zusätzlichen Wörtern.`;
  const blocks: Block[] = [{ type: 'paragraph', sentences: text.split(/(?<=\.) /) }];
  return {
    id: `test-${counter}`,
    source: 'test',
    sourceUrl: `https://example.org/${counter}`,
    lang: 'de',
    section: 'inland',
    title: `Beispiel ${counter}`,
    publishedAt: new Date(Date.UTC(2026, 9, 24, 6, counter % 60)).toISOString(),
    fetchedAt: '2026-10-24T06:00:00.000Z',
    blocks,
    wordCount: 60,
    readingMinutes: 1,
    status: 'ready',
    ...over,
  };
}

export function testConfig(over: Partial<AppConfig> = {}): AppConfig {
  return {
    settings: DEFAULT_SETTINGS,
    technikNetworks: DEFAULT_TECHNIK_NETWORKS,
    rssFeeds: ['br24-mittelfranken'],
    dbPath: ':memory:',
    dataDir: '.',
    openrouterApiKey: null,
    openrouterModel: 'test/modell',
    openrouterFallbackModel: null,
    summaryDailyLimit: 40,
    ...over,
  };
}
