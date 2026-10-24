import { describe, expect, it } from 'vitest';
import { htmlToBlocks } from '../src/core/clean.ts';
import { RateLimiter } from '../src/core/ratelimit.ts';
import { Br24Adapter, br24Section, parseFeed } from '../src/sources/br24.ts';
import { contentToHtml, TagesschauAdapter, tagesschauSection } from '../src/sources/tagesschau.ts';
import { fakeFetch, fixture } from './helpers.ts';

const BASE = 'https://example.org/api2u';

function tagesschau(calls: string[] = [], limit = 50) {
  return new TagesschauAdapter({
    baseUrl: BASE,
    hourlyLimit: limit,
    lists: ['/homepage/'],
    fetch: fakeFetch(
      {
        [`${BASE}/homepage/`]: fixture('tagesschau-homepage.json'),
        'https://example.org/api2u/ausland/detail-102.json': fixture('tagesschau-detail.json'),
      },
      calls,
    ),
  });
}

describe('tagesschau-Adapter', () => {
  it('liest nur Text-Meldungen aus der Liste', async () => {
    const items = await tagesschau().fetchList();
    expect(items.map((i) => i.id)).toEqual([
      'tagesschau_fm-story-beispiel-1',
      'tagesschau_fm-story-beispiel-3',
    ]);
    expect(items[0]?.section).toBe('inland');
    expect(items[0]?.publishedAt).toBe('2026-10-24T03:10:00.000Z');
  });

  it('nutzt mitgelieferten Inhalt und bereinigt ihn', async () => {
    const calls: string[] = [];
    const adapter = tagesschau(calls);
    const [first] = await adapter.fetchList();
    const raw = await adapter.fetchArticle(first!);
    expect(calls).toHaveLength(1);
    const blocks = htmlToBlocks(raw.html);
    const text = JSON.stringify(blocks);
    expect(text).toContain('Weniger Stau erwartet');
    expect(text).not.toContain('Kasten, der entfällt');
    expect(text).not.toContain('Zitat-Kasten');
    expect(text).not.toContain('Mehr zum Thema');
    expect(text).not.toContain('Über dieses Thema berichtete');
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      sentences: [
        'Nach zwei Jahren Bauzeit ist die neue Brücke in Beispielstadt für den Verkehr freigegeben worden.',
        'Autos, Busse und Fahrräder können den Fluss jetzt wieder ohne Umweg überqueren.',
      ],
    });
  });

  it('holt Details nach, wenn die Liste keinen Inhalt mitliefert', async () => {
    const calls: string[] = [];
    const adapter = tagesschau(calls);
    const items = await adapter.fetchList();
    const raw = await adapter.fetchArticle(items[1]!);
    expect(calls.at(-1)).toBe('https://example.org/api2u/ausland/detail-102.json');
    expect(raw.html).toContain('Museum für Seefahrt');
  });

  it('hält das Abruf-Kontingent ein', async () => {
    const adapter = tagesschau([], 1);
    const items = await adapter.fetchList();
    await expect(adapter.fetchArticle(items[1]!)).rejects.toThrow(/Kontingent/);
  });

  it('meldet Fehler, wenn keine Liste erreichbar ist', async () => {
    const adapter = new TagesschauAdapter({
      baseUrl: BASE,
      hourlyLimit: 50,
      lists: ['/x/'],
      fetch: fakeFetch({}),
    });
    await expect(adapter.fetchList()).rejects.toThrow(/404/);
  });

  it('normalisiert Rubriken', () => {
    expect(tagesschauSection({ ressort: 'ausland' })).toBe('ausland');
    expect(tagesschauSection({ ressort: 'investigativ' })).toBe('inland');
    expect(tagesschauSection({ regionId: 2 })).toBe('region');
    expect(tagesschauSection({})).toBe('nachrichten');
  });

  it('übernimmt nur Text und Überschriften', () => {
    expect(
      contentToHtml([
        { type: 'text', value: 'A' },
        { type: 'headline', value: 'B' },
        { type: 'video', value: 'C' },
      ]),
    ).toBe('<p>A</p>\n<h2>B</h2>');
  });
});

describe('BR24-Adapter', () => {
  it('liest den RSS-Feed', () => {
    const items = parseFeed(fixture('br24-feed.xml'));
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe('Freibad in Musterdorf bekommt neues Becken & Rutsche');
    expect(items[0]?.section).toBe('region');
    expect(items[1]?.section).toBe('sport');
    expect(items[0]?.id).toMatch(/^[0-9a-f]{16}$/);
    expect(items[0]?.publishedAt).toBe('2026-10-24T03:45:00.000Z');
  });

  it('holt den Volltext von der Artikelseite und bereinigt ihn', async () => {
    const feedUrl = 'https://example.org/feed.xml';
    const adapter = new Br24Adapter({
      feedUrl,
      fetch: fakeFetch({
        [feedUrl]: fixture('br24-feed.xml'),
        'https://example.org/nachrichten/freibad-musterdorf,ABC123': fixture('br24-article.html'),
      }),
    });
    const [item] = await adapter.fetchList();
    const raw = await adapter.fetchArticle(item!);
    const blocks = htmlToBlocks(raw.html);
    const text = JSON.stringify(blocks);
    expect(text).toContain('Das Freibad in Musterdorf wird im kommenden Winter umgebaut.');
    expect(text).toContain('Eröffnung im Juni geplant');
    expect(text).toContain('mehr als tausend Unterschriften');
    expect(text).not.toContain('Bildunterschrift');
    expect(text).not.toContain('Das alte Becken im Sommer');
    expect(text).not.toContain('Andere Bäder');
    expect(text).not.toContain('Impressum');
    expect(text).not.toContain('Teilen');
    expect(text).not.toContain('Zustimmen');
  });

  it('ordnet Sport-Kategorien zu', () => {
    expect(br24Section(['Fußball'])).toBe('sport');
    expect(br24Section(['Oberfranken'])).toBe('region');
  });
});

describe('RateLimiter', () => {
  it('lässt im Fenster nur das Limit zu und gibt danach wieder frei', () => {
    let now = 0;
    const r = new RateLimiter(2, 1000, () => now);
    expect(r.take()).toBe(true);
    expect(r.take()).toBe(true);
    expect(r.take()).toBe(false);
    now = 1001;
    expect(r.take()).toBe(true);
  });
});
