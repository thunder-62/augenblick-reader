/** Sätze für Vorschaukästen: lange Texte in Sätze teilen, damit nur ganze Sätze erscheinen. */
export function splitForSample(sentences: string[]): string[] {
  return sentences.flatMap((s) => s.split(/(?<=[.!?])\s+(?=\p{Lu})/u)).filter(Boolean);
}
