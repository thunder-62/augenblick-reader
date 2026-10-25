/**
 * Bilder der Artikel (Auftrag 007, ADR 021): Der Pi lädt sie beim Abholen herunter und liefert sie
 * selbst aus (`/media/<name>`). Das Tablet fragt nie bei fremden Servern an (CLAUDE.md). Bilder,
 * die kein Artikel mehr braucht, verschwinden mit dem Aufräumen.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Block } from '@augenblick/shared';
import { MIN_IMAGE_PX } from './clean.ts';
import type { Db } from './db.ts';
import { getBytes, type FetchLike, type LookupLike } from './http.ts';
import { log } from './log.ts';

/** Bildverzeichnis neben der Datenbank. */
export const mediaDir = (dataDir: string): string => path.join(dataDir, 'media');

/** Bilder sind selten größer; alles darüber wird nicht geladen. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Gültige Dateinamen im Bildverzeichnis: Prüfsumme und Endung. */
export const MEDIA_NAME = /^[a-f0-9]{40}\.(jpg|png|webp|gif)$/;

export const MEDIA_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

type Size = { width: number; height: number };

/** Format und Maße aus den ersten Bytes; null, wenn es kein unterstütztes Bild ist. */
export function sniffImage(b: Uint8Array): ({ ext: string } & Size) | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ascii = (from: number, len: number): string =>
    String.fromCharCode(...b.subarray(from, from + len));
  // PNG
  if (b.length > 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG')
    return { ext: 'png', width: view.getUint32(16), height: view.getUint32(20) };
  // GIF
  if (b.length > 10 && ascii(0, 3) === 'GIF')
    return { ext: 'gif', width: view.getUint16(6, true), height: view.getUint16(8, true) };
  // WebP
  if (b.length > 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const kind = ascii(12, 4);
    if (kind === 'VP8 ')
      return {
        ext: 'webp',
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    if (kind === 'VP8L') {
      const bits = view.getUint32(21, true);
      return { ext: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') {
      const w = (b[24] ?? 0) | ((b[25] ?? 0) << 8) | ((b[26] ?? 0) << 16);
      const h = (b[27] ?? 0) | ((b[28] ?? 0) << 8) | ((b[29] ?? 0) << 16);
      return { ext: 'webp', width: w + 1, height: h + 1 };
    }
    return null;
  }
  // JPEG: Segmente bis zum Bildkopf (SOF) durchlaufen
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1] ?? 0;
      const len = view.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { ext: 'jpg', height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

export type MediaOptions = {
  dir: string;
  fetch?: FetchLike;
  lookup?: LookupLike;
};

/**
 * Lädt die Bilder eines Artikels und ersetzt ihre Adressen durch `/media/<name>`.
 * Was nicht klappt (Fehler, kein Bild, zu klein), entfällt still – der Text bleibt.
 */
export async function localizeImages(blocks: Block[], opts: MediaOptions): Promise<Block[]> {
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.type !== 'image') {
      out.push(b);
      continue;
    }
    try {
      const { body } = await getBytes(b.src, {
        ...(opts.fetch ? { fetch: opts.fetch } : {}),
        ...(opts.lookup ? { lookup: opts.lookup } : {}),
        accept: 'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8',
        maxBytes: MAX_IMAGE_BYTES,
      });
      const info = sniffImage(body);
      if (!info) throw new Error('kein unterstütztes Bildformat');
      if (info.width < MIN_IMAGE_PX || info.height < MIN_IMAGE_PX) continue;
      const name = `${createHash('sha1').update(body).digest('hex')}.${info.ext}`;
      mkdirSync(opts.dir, { recursive: true });
      writeFileSync(path.join(opts.dir, name), body);
      out.push({
        type: 'image',
        src: `/media/${name}`,
        ...(b.alt ? { alt: b.alt } : {}),
        width: info.width,
        height: info.height,
      });
    } catch (err) {
      log.warn(`Bild übersprungen: ${b.src} – ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

/** Ohne Bildverzeichnis: fremde Bildadressen nie speichern. */
export const dropImages = (blocks: Block[]): Block[] => blocks.filter((b) => b.type !== 'image');

/**
 * Löscht Bilder, auf die kein gespeicherter Artikel mehr verweist. Frisch geschriebene Dateien
 * (jünger als eine Stunde) bleiben, falls gerade ein Artikel gespeichert wird.
 */
export function pruneMedia(db: Db, dir: string, now = Date.now()): number {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return 0;
  }
  const used = new Set<string>();
  const rows = db
    .prepare("SELECT blocks_json FROM articles WHERE blocks_json LIKE '%/media/%'")
    .all() as {
    blocks_json: string;
  }[];
  for (const r of rows)
    for (const m of r.blocks_json.matchAll(/\/media\/([a-f0-9]{40}\.[a-z]+)/g))
      if (m[1]) used.add(m[1]);
  let removed = 0;
  for (const f of files) {
    if (!MEDIA_NAME.test(f) || used.has(f)) continue;
    const file = path.join(dir, f);
    try {
      if (now - statSync(file).mtimeMs < 60 * 60 * 1000) continue;
      unlinkSync(file);
      removed++;
    } catch {
      // schon weg
    }
  }
  return removed;
}
