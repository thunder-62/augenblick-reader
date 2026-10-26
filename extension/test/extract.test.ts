import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import type { Block } from '@augenblick/shared';
import { canRead, extractArticle, type ExtractOptions } from '../src/extract.ts';

const PAGES = path.resolve(import.meta.dirname, 'pages');
const BASE = 'https://anzeiger.example/lokales/';

function load(name: string): Document {
  return parseHTML(readFileSync(path.join(PAGES, name), 'utf8')).document as unknown as Document;
}

/** Wie im Browser: Bilder sind mit der Größe aus ihren Attributen „geladen“. */
const opts: ExtractOptions = {
  loadedImage: (img) => {
    const src = img.getAttribute('src');
    const width = Number(img.getAttribute('width'));
    const height = Number(img.getAttribute('height'));
    return src && width && height ? { src: new URL(src, BASE).toString(), width, height } : null;
  },
  parseHtml: (html) =>
    parseHTML(`<!doctype html><html><body>${html}</body></html>`).document as unknown as Document,
};

const text = (blocks: Block[]): string =>
  blocks
    .map((b) =>
      b.type === 'paragraph' ? b.sentences.join(' ') : b.type === 'heading' ? b.text : '',
    )
    .join('\n');

describe('Taste „Lesen“ nur auf lesbaren Seiten (SPEC §16.2)', () => {
  it('Nachrichtenartikel und Seite mit Cookie-Banner: ja', () => {
    expect(canRead(load('artikel.html'))).toBe(true);
    expect(canRead(load('banner.html'))).toBe(true);
  });

  it('Startseite mit Übersicht ohne Artikel: nein', () => {
    expect(canRead(load('start.html'))).toBe(false);
  });

  it('Anmeldeseite mit Passwortfeld: nein, auch mit viel Text', () => {
    const doc = load('login.html');
    expect(canRead(doc)).toBe(false);
    doc.querySelector('form')?.remove();
    expect(canRead(doc)).toBe(true);
  });

  it('nachgeladener Artikel: erst nein, nach dem Laden ja', () => {
    const doc = load('nachgeladen.html');
    expect(canRead(doc)).toBe(false);
    const script = readFileSync(path.join(PAGES, 'nachgeladen.js'), 'utf8');
    new Function('document', 'setTimeout', script)(doc, (fn: () => void) => fn());
    expect(canRead(doc)).toBe(true);
    const article = extractArticle(doc, opts);
    expect(article?.title).toBe('Brücke über den Mühlbach gesperrt');
    expect(article?.blocks.filter((b) => b.type === 'paragraph')).toHaveLength(4);
  });
});

describe('Textgewinnung (SPEC §16.3)', () => {
  it('Artikel mit Zwischenüberschriften und Bildern, ohne Beiwerk', () => {
    const article = extractArticle(load('artikel.html'), opts);
    expect(article).not.toBeNull();
    const { title, lang, blocks } = article!;
    expect(title).toBe('Neues Dach für den Wochenmarkt');
    expect(lang).toBe('de');
    // Die Überschrift steht nicht doppelt im Text.
    expect(blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(
      blocks.filter((b) => b.type === 'heading').map((b) => b.type === 'heading' && b.text),
    ).toEqual(['Was sich für die Besucher ändert', 'Wie es weitergeht']);
    // Bilder an ihrer Stelle, ohne Unterschrift, ohne Zählpixel.
    const images = blocks.filter((b) => b.type === 'image');
    expect(images.map((b) => b.type === 'image' && b.src)).toEqual([
      `${BASE.replace('/lokales/', '')}/bilder/marktplatz.png`,
      `${BASE.replace('/lokales/', '')}/bilder/entwurf.png`,
    ]);
    expect(blocks.findIndex((b) => b.type === 'image')).toBe(1);
    const all = text(blocks);
    expect(all).not.toMatch(/Foto: Testbild|Zeichnung: Testbild/);
    expect(all).not.toMatch(/Mehr zum Thema|Parkgebühren|Impressum|Lokales Sport/);
    // Satztrennung wie auf dem Pi: „1,2 Mio. Euro“ bleibt in einem Satz.
    const para = blocks.find(
      (b) => b.type === 'paragraph' && b.sentences[0]?.startsWith('Nach Angaben'),
    );
    expect(para?.type === 'paragraph' && para.sentences[0]).toBe(
      'Nach Angaben der Verwaltung kostet der Bau rund 1,2 Mio. Euro.',
    );
  });

  it('Seite mit Cookie-Banner und Teilen-Knöpfen: nur der Artikel', () => {
    const article = extractArticle(load('banner.html'), opts);
    const all = text(article!.blocks);
    expect(article!.title).toBe('Chor feiert hundertsten Geburtstag');
    expect(all).toMatch(/^Der gemischte Chor aus Musterstadt/);
    expect(all).not.toMatch(/Cookies|akzeptieren|Teilen|Drucken|E-Mail senden|Foto: Testbild/i);
    expect(article!.blocks.filter((b) => b.type === 'paragraph')).toHaveLength(4);
  });

  it('Bilder, die die Seite nicht geladen hat, entfallen (keine eigenen Abrufe)', () => {
    const article = extractArticle(load('artikel.html'), { ...opts, loadedImage: () => null });
    expect(article!.blocks.some((b) => b.type === 'image')).toBe(false);
  });

  it('ohne Artikeltext: null (ruhiger Hinweis in der Leseansicht)', () => {
    expect(extractArticle(load('start.html'), opts)).toBeNull();
  });
});
