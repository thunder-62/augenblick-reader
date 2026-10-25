/** Zählt Wörter über alle Sätze. */
export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

/** Lesezeit, Basis 70 Wörter pro Minute (AMD-Lesetempo, SPEC §4). */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 70));
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00AD|\u200B|\u200C|\u200D|\uFEFF/g, '')
    .replace(/[\s\u00A0]+/g, ' ')
    .trim();
}
