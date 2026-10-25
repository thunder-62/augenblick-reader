/**
 * Bereinigung zu Block[] (SPEC §5.2, Schritt 2): Werbung, Bildunterschriften,
 * „Mehr zum Thema“, Links, Social-Embeds und Bildnachweise entfernen,
 * Zwischenüberschriften und Bilder behalten (Bilder ohne Unterschrift, ADR 021).
 * Der eigentliche Text bleibt unverändert.
 */
import { parseHTML } from 'linkedom';
import type { Block } from '@augenblick/shared';
import { splitSentences } from './sentences.ts';
import { normalizeWhitespace } from './text.ts';

/** Elemente, die nie Lesetext enthalten. */
const DROP_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'video',
  'audio',
  'svg',
  'figcaption',
  'aside',
  'nav',
  'form',
  'button',
  'header',
  'footer',
  'table',
  '[aria-hidden="true"]',
  '[hidden]',
  'blockquote.twitter-tweet',
  'blockquote.instagram-media',
  '.ad',
  '.ads',
  '.advertisement',
  '.teaser',
  '.related',
  '.social',
  '.share',
  '.copyright',
  '.credits',
  '.caption',
].join(',');

/** Absätze, die mit diesen Mustern beginnen, sind Beiwerk. */
const NOISE_PATTERNS: RegExp[] = [
  /^mehr zu(m| diesem) thema\b/i,
  /^mehr (dazu|zum thema|informationen)\s*:/i,
  /^(lesen|sehen|hören) sie (auch|hier|mehr)\b/i,
  /^auch interessant\b/i,
  /^das könnte sie auch interessieren\b/i,
  /^über dieses thema berichtete?\b/i,
  /^dieses thema im programm\b/i,
  /^(bild|foto|fotos|bildquelle|bildrechte|quelle bild)\s*:/i,
  /^©/,
  /^(anzeige|werbung)$/i,
  /^hier (geht'?s|gelangen sie|finden sie)\b.*(zum|zur|zu den)\b/i,
  /^(jetzt )?(teilen|abonnieren)\b/i,
  /^(folgen sie|du willst|sie wollen) .*(whatsapp|instagram|facebook|newsletter|kanal)/i,
  /^zur startseite$/i,
];

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const TEXT_TAGS = new Set(['P', 'LI', 'DD']);
const CONTAINER_TAGS = new Set([
  'DIV',
  'SECTION',
  'ARTICLE',
  'MAIN',
  'BODY',
  'UL',
  'OL',
  'DL',
  'BLOCKQUOTE',
  'FIGURE',
  'PICTURE',
]);
const INLINE_TAGS = new Set([
  'A',
  'ABBR',
  'B',
  'CITE',
  'CODE',
  'EM',
  'I',
  'MARK',
  'Q',
  'S',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TIME',
  'U',
]);

export function isNoise(text: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(text));
}

/** Text eines Elements; Absätze, die nur aus Links bestehen, gelten als Linkliste. */
function readText(el: Element): { text: string; onlyLinks: boolean } {
  const text = normalizeWhitespace(el.textContent ?? '');
  const linkText = normalizeWhitespace(
    Array.from(el.querySelectorAll('a'))
      .map((a) => a.textContent ?? '')
      .join(' '),
  );
  const onlyLinks =
    linkText.length > 0 && linkText.length >= text.replace(/[\s•·|,–-]/g, '').length * 0.9;
  return { text, onlyLinks };
}

export function paragraph(text: string): Block | null {
  const sentences = splitSentences(text);
  return sentences.length ? { type: 'paragraph', sentences } : null;
}

/** Kleinere Bilder sind meist Symbole, Logos oder Zählpixel. */
export const MIN_IMAGE_PX = 200;

/** Größte Variante aus `srcset` bis 1600 px Breite, sonst `src` bzw. `data-src`. */
function imageUrl(img: Element): string | null {
  const srcset = img.getAttribute('srcset') ?? img.getAttribute('data-srcset');
  if (srcset) {
    const candidates = srcset
      .split(',')
      .map((part) => part.trim().split(/\s+/))
      .map(([url = '', size = '']) => ({ url, w: Number(size.replace(/w$/, '')) || 0 }))
      .filter((c) => c.url);
    const fitting = candidates.filter((c) => c.w <= 1600).sort((a, b) => b.w - a.w);
    const best = fitting[0] ?? candidates.sort((a, b) => a.w - b.w)[0];
    if (best) return best.url;
  }
  return img.getAttribute('src') ?? img.getAttribute('data-src');
}

/**
 * Bild als Block mit absoluter http(s)-Adresse der Quelle; der Pi lädt es später herunter
 * (media.ts). Symbole, Logos, SVG und eingebettete Daten entfallen.
 */
export function imageBlock(img: Element, baseUrl?: string): Block | null {
  const raw = imageUrl(img);
  if (!raw || raw.startsWith('data:')) return null;
  let url: URL;
  try {
    url = new URL(raw, baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (/\.svg$/i.test(url.pathname)) return null;
  const w = Number(img.getAttribute('width'));
  const h = Number(img.getAttribute('height'));
  if ((w && w < MIN_IMAGE_PX) || (h && h < MIN_IMAGE_PX)) return null;
  const alt = normalizeWhitespace(img.getAttribute('alt') ?? '');
  return { type: 'image', src: url.toString(), ...(alt ? { alt } : {}) };
}

export function heading(text: string): Block | null {
  const t = normalizeWhitespace(text);
  return t ? { type: 'heading', text: t } : null;
}

/** Höchstens so viele Bilder je Artikel. */
export const MAX_IMAGES = 6;

/** Wandelt HTML (Artikelkörper) in Blöcke um; `baseUrl` löst relative Bildadressen auf. */
export function htmlToBlocks(html: string, baseUrl?: string): Block[] {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  for (const el of Array.from(document.querySelectorAll(DROP_SELECTOR))) el.remove();

  const blocks: Block[] = [];
  let skipUntilHeading = false;
  const seenImages = new Set<string>();
  const pushImage = (img: Element): void => {
    if (skipUntilHeading || seenImages.size >= MAX_IMAGES) return;
    const b = imageBlock(img, baseUrl);
    if (!b || b.type !== 'image' || seenImages.has(b.src)) return;
    seenImages.add(b.src);
    blocks.push(b);
  };

  const visit = (el: Element): void => {
    const tag = el.tagName.toUpperCase();
    if (tag === 'IMG') {
      pushImage(el);
      return;
    }
    if (HEADING_TAGS.has(tag)) {
      const text = normalizeWhitespace(el.textContent ?? '');
      if (!text) return;
      // „Mehr zum Thema“ als Überschrift: alles bis zur nächsten Überschrift ist Linkliste.
      if (isNoise(text) || /^mehr zum thema/i.test(text)) {
        skipUntilHeading = true;
        return;
      }
      skipUntilHeading = false;
      const b = heading(text);
      if (b) blocks.push(b);
      return;
    }
    if (TEXT_TAGS.has(tag)) {
      if (skipUntilHeading) return;
      const { text, onlyLinks } = readText(el);
      if (text && !onlyLinks && !isNoise(text)) {
        const b = paragraph(text);
        if (b) blocks.push(b);
      }
      // Bilder innerhalb eines Absatzes stehen danach.
      for (const img of Array.from(el.querySelectorAll('img'))) pushImage(img);
      return;
    }
    if (CONTAINER_TAGS.has(tag)) {
      // Lose Texte direkt im Container (ohne <p>) als Absatz übernehmen.
      let loose = '';
      let looseLinks = '';
      const flush = (): void => {
        const t = normalizeWhitespace(loose);
        const onlyLinks = normalizeWhitespace(looseLinks).length >= t.length * 0.9;
        loose = '';
        looseLinks = '';
        if (!t || onlyLinks || skipUntilHeading || isNoise(t)) return;
        const b = paragraph(t);
        if (b) blocks.push(b);
      };
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === 3) {
          loose += node.textContent ?? '';
          continue;
        }
        if (node.nodeType !== 1) continue;
        const child = node as Element;
        const ct = child.tagName.toUpperCase();
        if (ct === 'BR') {
          flush();
        } else if (INLINE_TAGS.has(ct)) {
          const t = child.textContent ?? '';
          loose += t;
          if (ct === 'A') looseLinks += t;
        } else {
          flush();
          visit(child);
        }
      }
      flush();
    }
  };

  visit(document.body as unknown as Element);
  return trimTrailingHeadings(blocks);
}

/** Überschriften ohne folgenden Text am Ende sind Reste von Linklisten. */
export function trimTrailingHeadings(blocks: Block[]): Block[] {
  const out = [...blocks];
  while (out.length) {
    const last = out.at(-1);
    if (last?.type !== 'heading') break;
    out.pop();
  }
  return out;
}

/** Klartext (z. B. aus einem Feed) in einen Absatz. */
export function textToBlocks(text: string): Block[] {
  return text
    .split(/\n{2,}/)
    .map((p) => paragraph(p))
    .filter((b): b is Block => b !== null);
}
