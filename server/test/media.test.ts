import { mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import type { Block } from '@augenblick/shared';
import { createApp } from '../src/app.ts';
import { htmlToBlocks, MAX_IMAGES } from '../src/core/clean.ts';
import { openDb, upsertArticle } from '../src/core/db.ts';
import type { FetchLike, LookupLike } from '../src/core/http.ts';
import { localizeImages, mediaDir, pruneMedia, sniffImage } from '../src/core/media.ts';
import { contentToHtml, pickImageVariant } from '../src/sources/tagesschau.ts';
import { makeArticle, testConfig } from './helpers.ts';

/** Kleines, gültiges PNG in einer Farbe (selbst erzeugt, keine fremden Bilder im Repo). */
function png(width: number, height: number): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (const b of buf) c = (crcTable[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x80)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

const PUBLIC: LookupLike = async () => [{ address: '93.184.215.14', family: 4 }];

describe('Bilder in der Bereinigung (ADR 021)', () => {
  it('übernimmt Bilder an ihrer Stelle, ohne Bildunterschrift', () => {
    const blocks = htmlToBlocks(
      `<p>Erster Satz.</p>
       <figure><img src="/bilder/a.jpg" alt=" Ein Becken "><figcaption>Foto: dpa</figcaption></figure>
       <p>Zweiter Satz.</p>`,
      'https://example.org/artikel/1',
    );
    expect(blocks).toEqual([
      { type: 'paragraph', sentences: ['Erster Satz.'] },
      { type: 'image', src: 'https://example.org/bilder/a.jpg', alt: 'Ein Becken' },
      { type: 'paragraph', sentences: ['Zweiter Satz.'] },
    ]);
  });

  it('wählt aus srcset die größte Variante bis 1600 px', () => {
    const [b] = htmlToBlocks(
      '<img srcset="https://x.example/s.jpg 400w, https://x.example/m.jpg 1200w, https://x.example/l.jpg 2400w">',
    );
    expect(b).toMatchObject({ type: 'image', src: 'https://x.example/m.jpg' });
  });

  it('lässt Symbole, SVG, eingebettete Daten und zu viele Bilder weg', () => {
    const blocks = htmlToBlocks(`
      <img src="https://x.example/logo.svg">
      <img src="data:image/png;base64,AAAA">
      <img src="https://x.example/icon.png" width="32" height="32">
      ${Array.from({ length: 9 }, (_, i) => `<img src="https://x.example/${i}.jpg">`).join('')}
    `);
    expect(blocks.filter((b) => b.type === 'image')).toHaveLength(MAX_IMAGES);
    expect(blocks.some((b) => b.type === 'image' && /svg|data:|icon/.test(b.src))).toBe(false);
  });

  it('tagesschau: Aufmacherbild und Galerie, Querformat bis 1280 px', () => {
    expect(
      pickImageVariant({
        '1x1-840': 'q',
        '16x9-640': 'a',
        '16x9-1280': 'b',
        '16x9-1920': 'c',
      }),
    ).toBe('b');
    const html = contentToHtml(
      [
        { type: 'text', value: 'Text.' },
        {
          type: 'image_gallery',
          gallery: [
            { alttext: 'Zwei "Boote"', imageVariants: { '16x9-960': 'https://t.example/g.jpg' } },
          ],
        },
      ],
      { alttext: 'Aufmacher', imageVariants: { '16x9-960': 'https://t.example/a.jpg' } },
    );
    expect(htmlToBlocks(html).map((b) => b.type)).toEqual(['image', 'paragraph', 'image']);
    expect(html).toContain('alt="Zwei &quot;Boote&quot;"');
  });
});

describe('Bilder herunterladen und selbst ausliefern', () => {
  const dirs: string[] = [];
  const tmp = (): string => {
    const d = mkdtempSync(path.join(tmpdir(), 'augenblick-media-'));
    dirs.push(d);
    return d;
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('erkennt Format und Maße', () => {
    expect(sniffImage(png(640, 360))).toEqual({ ext: 'png', width: 640, height: 360 });
    expect(sniffImage(new TextEncoder().encode('<html>kein Bild</html>'))).toBe(null);
    // AVIF: ftyp „avif“ und Maße im Kasten „ispe“ (Breite, Höhe nach Version/Flags)
    const avif = Buffer.alloc(48);
    avif.writeUInt32BE(24, 0);
    avif.write('ftypavif', 4, 'ascii');
    avif.writeUInt32BE(20, 24);
    avif.write('ispe', 28, 'ascii');
    avif.writeUInt32BE(1280, 36);
    avif.writeUInt32BE(720, 40);
    expect(sniffImage(new Uint8Array(avif))).toEqual({ ext: 'avif', width: 1280, height: 720 });
  });

  it('ersetzt fremde Adressen durch /media/…, Fehler und Kleines entfallen', async () => {
    const dir = tmp();
    const files: Record<string, () => Response> = {
      'https://x.example/gross.png': () => new Response(Buffer.from(png(800, 450))),
      'https://x.example/klein.png': () => new Response(Buffer.from(png(100, 100))),
      'https://x.example/seite.html': () => new Response('<html></html>'),
    };
    const accepts: string[] = [];
    const fetch: FetchLike = async (url, init) => {
      accepts.push(new Headers(init?.headers).get('accept') ?? '');
      return files[url]?.() ?? new Response('fehlt', { status: 404 });
    };
    const blocks: Block[] = [
      { type: 'paragraph', sentences: ['Satz.'] },
      { type: 'image', src: 'https://x.example/gross.png', alt: 'Ein Bild' },
      { type: 'image', src: 'https://x.example/klein.png' },
      { type: 'image', src: 'https://x.example/seite.html' },
      { type: 'image', src: 'https://x.example/fehlt.png' },
      { type: 'image', src: 'http://192.168.1.1/intern.png' },
    ];
    const out = await localizeImages(blocks, { dir, fetch, lookup: PUBLIC });
    expect(out).toHaveLength(2);
    const img = out[1];
    expect(img).toMatchObject({ type: 'image', alt: 'Ein Bild', width: 800, height: 450 });
    expect(img?.type === 'image' && img.src).toMatch(/^\/media\/[a-f0-9]{40}\.png$/);
    expect(readdirSync(dir)).toHaveLength(1);
    // Kein AVIF anfordern (sonst liefern manche Bildserver AVIF statt JPEG).
    expect(accepts.every((a) => a.startsWith('image/jpeg') && !a.includes('avif'))).toBe(true);
  });

  it('räumt Bilder auf, die kein Artikel mehr braucht', async () => {
    const db = openDb(':memory:');
    const dir = tmp();
    const keep = 'a'.repeat(40) + '.png';
    const old = 'b'.repeat(40) + '.png';
    const fresh = 'c'.repeat(40) + '.png';
    for (const f of [keep, old, fresh]) writeFileSync(path.join(dir, f), 'x');
    const hourAgo = (Date.now() - 2 * 60 * 60 * 1000) / 1000;
    utimesSync(path.join(dir, keep), hourAgo, hourAgo);
    utimesSync(path.join(dir, old), hourAgo, hourAgo);
    const a = makeArticle();
    upsertArticle(db, { ...a, blocks: [...a.blocks, { type: 'image', src: `/media/${keep}` }] });
    expect(pruneMedia(db, dir)).toBe(1);
    expect(readdirSync(dir).sort()).toEqual([keep, fresh].sort());
  });

  it('die API liefert nur gültige Bilddateien aus dem Bildverzeichnis', async () => {
    const dataDir = tmp();
    const config = { ...testConfig(), dataDir };
    const app = createApp({ db: openDb(':memory:'), config, webDist: null });
    const name = 'd'.repeat(40) + '.png';
    const body = png(300, 200);
    const media = mediaDir(dataDir);
    rmSync(media, { recursive: true, force: true });
    (await import('node:fs')).mkdirSync(media, { recursive: true });
    writeFileSync(path.join(media, name), body);

    const ok = await app.inject(`/media/${name}`);
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toBe('image/png');
    expect(ok.rawPayload.length).toBe(body.length);
    for (const bad of ['../augenblick.sqlite', '%2e%2e%2fx.png', 'abc.png', `${name}.exe`])
      expect((await app.inject(`/media/${bad}`)).statusCode, bad).toBe(404);
  });
});
