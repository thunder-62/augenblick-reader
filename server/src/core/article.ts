import type { Article, Block, Summary } from '@augenblick/shared';
import { MAX_SUMMARY_WORDS } from './summary.ts';
import { countWords, normalizeWhitespace, readingMinutes } from './text.ts';

export const FALLBACK_SUMMARY_MODEL = 'fallback-erste-saetze';
export const TEASER_SUMMARY_MODEL = 'anreisser-der-quelle';

/** Was ein Quellen-Adapter nach dem Bereinigen liefert. */
export type CleanArticle = {
  originalId: string;
  sourceUrl: string;
  lang: string;
  section?: string;
  title: string;
  publishedAt: string;
  blocks: Block[];
  /** Anreißer der Quelle (RSS-Beschreibung, erster Satz der tagesschau) für die Kurzfassung ohne KI. */
  teaser?: string;
};

export function makeArticleId(source: string, originalId: string): string {
  const safe = originalId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${source}-${safe}`;
}

export function blocksWordCount(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    n += b.type === 'heading' ? countWords(b.text) : countWords(b.sentences.join(' '));
  }
  return n;
}

/** Höchstens 45 Wörter; ein längerer Text wird nach 45 Wörtern mit „…“ gekürzt. */
export function limitWords(text: string): string {
  if (countWords(text) <= MAX_SUMMARY_WORDS) return text;
  return `${text
    .split(/\s+/)
    .slice(0, MAX_SUMMARY_WORDS)
    .join(' ')
    .replace(/[,;:–-]+$/, '')} …`;
}

/**
 * Kurzfassung ohne KI (SPEC §6): der Anreißer der Quelle, sonst die ersten zwei Sätze des Artikels
 * (bzw. nur der erste, wenn beide zusammen zu lang wären) – immer höchstens 45 Wörter.
 */
export function fallbackSummary(
  blocks: Block[],
  now: string,
  teaser?: string,
): Summary | undefined {
  const t = teaser ? normalizeWhitespace(teaser) : '';
  if (countWords(t) >= 5)
    return { text: limitWords(t), model: TEASER_SUMMARY_MODEL, createdAt: now };
  const sentences = blocks.flatMap((b) => (b.type === 'paragraph' ? b.sentences : []));
  const first = sentences[0];
  if (!first) return undefined;
  const second = sentences[1];
  const text =
    second && countWords(`${first} ${second}`) <= MAX_SUMMARY_WORDS
      ? `${first} ${second}`
      : limitWords(first);
  return { text, model: FALLBACK_SUMMARY_MODEL, createdAt: now };
}

/** KI-Kurzfassungen bekommen den Funkelstern; Anreißer und erste Sätze nicht. */
export const isAiSummary = (s: Summary | undefined): boolean =>
  Boolean(s && s.model !== FALLBACK_SUMMARY_MODEL && s.model !== TEASER_SUMMARY_MODEL);

/** Mindestumfang, damit ein Artikel in die Ausgabe darf. */
export const MIN_WORDS = 40;

export function buildArticle(source: string, clean: CleanArticle, now: string): Article {
  const wordCount = blocksWordCount(clean.blocks);
  const hasText = clean.blocks.some((b) => b.type === 'paragraph');
  const summary = fallbackSummary(clean.blocks, now, clean.teaser);
  return {
    id: makeArticleId(source, clean.originalId),
    source,
    sourceUrl: clean.sourceUrl,
    lang: clean.lang,
    ...(clean.section ? { section: clean.section } : {}),
    title: clean.title.trim(),
    publishedAt: clean.publishedAt,
    fetchedAt: now,
    blocks: clean.blocks,
    ...(summary ? { summary } : {}),
    wordCount,
    readingMinutes: readingMinutes(wordCount),
    status: hasText && wordCount >= MIN_WORDS && clean.title.trim() ? 'ready' : 'failed',
  };
}
