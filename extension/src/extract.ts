/**
 * Textgewinnung in der Seite (SPEC §16.3): Readability auf einer Kopie des Dokuments, danach die
 * gemeinsame Bereinigung und Satztrennung (ADR 023). Keine eigenen Netzabrufe: Bilder bleiben nur,
 * wenn die Seite sie schon geladen hat, und zwar in der Größe, die die Seite geladen hat (ADR 024).
 */
import { isProbablyReaderable, Readability } from '@mozilla/readability';
import { MIN_IMAGE_PX, normalizeWhitespace, elementToBlocks } from '@augenblick/shared/text';
import type { PageArticle } from './messages.ts';

/** Von der Seite geladenes Bild: Adresse und echte Größe, oder null (nicht geladen). */
export type LoadedImage = { src: string; width: number; height: number } | null;

export type ExtractOptions = {
  /** Wie das Bild auf der Seite geladen ist; im Browser `currentSrc` und `naturalWidth`. */
  loadedImage?: (img: HTMLImageElement) => LoadedImage;
  /** HTML einlesen, ohne Skripte auszuführen (im Browser `DOMParser`). */
  parseHtml?: (html: string) => Document;
};

const browserLoadedImage = (img: HTMLImageElement): LoadedImage =>
  img.complete && img.naturalWidth > 0 && /^https?:/.test(img.currentSrc)
    ? { src: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight }
    : null;

const browserParseHtml = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html');

/** Taste nur auf lesbaren Seiten, nie mit Passwortfeld, nie auf Seiten der Erweiterung (§16.2). */
export function canRead(doc: Document): boolean {
  const protocol = doc.location?.protocol ?? 'https:';
  if (protocol !== 'http:' && protocol !== 'https:') return false;
  if (doc.querySelector('input[type="password" i]')) return false;
  return isProbablyReaderable(doc);
}

/**
 * Bilder der Kopie auf das setzen, was die Seite geladen hat. Kopie und Original haben dieselbe
 * Reihenfolge der `<img>`, solange noch nichts an der Kopie verändert ist.
 */
function pinLoadedImages(
  original: Document,
  copy: Document,
  loaded: (img: HTMLImageElement) => LoadedImage,
): void {
  const originals = Array.from(original.querySelectorAll('img'));
  const copies = Array.from(copy.querySelectorAll('img'));
  copies.forEach((img, i) => {
    const source = originals[i];
    const info = source ? loaded(source) : null;
    if (!info || info.width < MIN_IMAGE_PX || info.height < MIN_IMAGE_PX) {
      img.remove();
      return;
    }
    for (const a of ['srcset', 'data-src', 'data-srcset', 'sizes', 'loading'])
      img.removeAttribute(a);
    img.setAttribute('src', info.src);
    img.setAttribute('width', String(info.width));
    img.setAttribute('height', String(info.height));
  });
  // <source> würde eine andere Größe wählen als die geladene.
  for (const s of Array.from(copy.querySelectorAll('picture source'))) s.remove();
}

/**
 * Readability nimmt oft den Fenstertitel mit dem Namen der Website („… – Musterstädter Anzeiger“).
 * Steht die Hauptüberschrift der Seite darin, gilt sie.
 */
function pickTitle(doc: Document, parsedTitle: string | null | undefined): string {
  const candidate = normalizeWhitespace(parsedTitle || doc.title || '');
  for (const h1 of Array.from(doc.querySelectorAll('h1'))) {
    const text = normalizeWhitespace(h1.textContent ?? '');
    if (text && candidate.includes(text)) return text;
  }
  return candidate;
}

export function extractArticle(doc: Document, opts: ExtractOptions = {}): PageArticle | null {
  const copy = doc.cloneNode(true) as Document;
  pinLoadedImages(doc, copy, opts.loadedImage ?? browserLoadedImage);
  // Klassen behalten, damit die gemeinsame Bereinigung Teilen-Knöpfe, Bildnachweise usw. erkennt.
  const parsed = new Readability(copy, { keepClasses: true }).parse();
  if (!parsed?.content) return null;
  const body = (opts.parseHtml ?? browserParseHtml)(parsed.content).body;
  const baseUrl = doc.location?.href || doc.baseURI || undefined;
  const blocks = elementToBlocks(body, baseUrl);
  const title = pickTitle(doc, parsed.title);
  // Readability lässt die Hauptüberschrift oft auch im Text stehen.
  const first = blocks[0];
  if (first?.type === 'heading' && first.text === title) blocks.shift();
  if (!blocks.some((b) => b.type === 'paragraph')) return null;
  return {
    title,
    lang: parsed.lang || doc.documentElement.lang || 'de',
    site: normalizeWhitespace(parsed.siteName || doc.location?.hostname || ''),
    blocks,
  };
}
