/**
 * Bereinigung zu Block[] (SPEC §5.2, Schritt 2): Werbung, Bildunterschriften,
 * „Mehr zum Thema“, Links, Social-Embeds und Bildnachweise entfernen,
 * Zwischenüberschriften behalten. Der eigentliche Text bleibt unverändert.
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
  'picture',
  'img',
  'svg',
  'figure',
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

export function heading(text: string): Block | null {
  const t = normalizeWhitespace(text);
  return t ? { type: 'heading', text: t } : null;
}

/** Wandelt HTML (Artikelkörper) in Blöcke um. */
export function htmlToBlocks(html: string): Block[] {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  for (const el of Array.from(document.querySelectorAll(DROP_SELECTOR))) el.remove();

  const blocks: Block[] = [];
  let skipUntilHeading = false;

  const visit = (el: Element): void => {
    const tag = el.tagName.toUpperCase();
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
      if (!text || onlyLinks || isNoise(text)) return;
      const b = paragraph(text);
      if (b) blocks.push(b);
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
  while (out.at(-1)?.type === 'heading') out.pop();
  return out;
}

/** Klartext (z. B. aus einem Feed) in einen Absatz. */
export function textToBlocks(text: string): Block[] {
  return text
    .split(/\n{2,}/)
    .map((p) => paragraph(p))
    .filter((b): b is Block => b !== null);
}
