import type { Article, Block, Summary } from '@augenblick/shared';
import { MAX_SUMMARY_WORDS } from './summary.ts';
import { countWords, readingMinutes } from './text.ts';

export const FALLBACK_SUMMARY_MODEL = 'fallback-erste-saetze';

/** Was ein Quellen-Adapter nach dem Bereinigen liefert. */
export type CleanArticle = {
  originalId: string;
  sourceUrl: string;
  lang: string;
  section?: string;
  title: string;
  publishedAt: string;
  blocks: Block[];
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

/**
 * Fallback-Kurzfassung (SPEC §6): die ersten Sätze des Artikels, höchstens zwei und zusammen
 * höchstens 45 Wörter. Ist schon der erste Satz länger, wird er nach 45 Wörtern mit „…“ gekürzt.
 */
export function fallbackSummary(blocks: Block[], now: string): Summary | undefined {
  const sentences = blocks.flatMap((b) => (b.type === 'paragraph' ? b.sentences : []));
  const first = sentences[0];
  if (!first) return undefined;
  const firstWords = first.split(/\s+/);
  let text: string;
  if (countWords(first) > MAX_SUMMARY_WORDS) {
    text = `${firstWords
      .slice(0, MAX_SUMMARY_WORDS)
      .join(' ')
      .replace(/[,;:–-]+$/, '')} …`;
  } else {
    const second = sentences[1];
    text =
      second && countWords(`${first} ${second}`) <= MAX_SUMMARY_WORDS
        ? `${first} ${second}`
        : first;
  }
  return { text, model: FALLBACK_SUMMARY_MODEL, createdAt: now };
}

export const isAiSummary = (s: Summary | undefined): boolean =>
  Boolean(s && s.model !== FALLBACK_SUMMARY_MODEL);

/** Mindestumfang, damit ein Artikel in die Ausgabe darf. */
export const MIN_WORDS = 40;

export function buildArticle(source: string, clean: CleanArticle, now: string): Article {
  const wordCount = blocksWordCount(clean.blocks);
  const hasText = clean.blocks.some((b) => b.type === 'paragraph');
  const summary = fallbackSummary(clean.blocks, now);
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
