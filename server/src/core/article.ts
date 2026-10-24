import type { Article, Block, Summary } from '@augenblick/shared';
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

/** Kurzfassung bis M3: die ersten zwei Sätze des Artikels (Fallback aus SPEC §6). */
export function fallbackSummary(blocks: Block[], now: string): Summary | undefined {
  const sentences: string[] = [];
  for (const b of blocks) {
    if (b.type !== 'paragraph') continue;
    for (const s of b.sentences) {
      sentences.push(s);
      if (sentences.length === 2) break;
    }
    if (sentences.length === 2) break;
  }
  if (!sentences.length) return undefined;
  return { text: sentences.join(' '), model: FALLBACK_SUMMARY_MODEL, createdAt: now };
}

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
