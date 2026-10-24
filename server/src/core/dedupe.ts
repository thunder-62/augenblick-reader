/**
 * Dubletten zwischen Quellen erkennen (SPEC §5.1/§5.2), vorerst ohne KI:
 * Vergleich der bedeutungstragenden Wörter aus Titel und erstem Satz.
 */
import type { Article } from '@augenblick/shared';

// prettier-ignore
const STOPWORDS = new Set([
  'aber', 'alle', 'allem', 'allen', 'aller', 'alles', 'also', 'auch', 'auf', 'aus', 'bei', 'beim',
  'bereits', 'bis', 'bisher', 'damit', 'dann', 'darf', 'dass', 'dem', 'den', 'denn', 'der', 'des',
  'die', 'dies', 'diese', 'diesem', 'diesen', 'dieser', 'dieses', 'doch', 'dort', 'durch', 'eine',
  'einem', 'einen', 'einer', 'eines', 'etwa', 'für', 'gegen', 'gibt', 'haben', 'hat', 'hatte',
  'heute', 'hier', 'ihre', 'ihren', 'ihrer', 'immer', 'jetzt', 'kann', 'kein', 'keine', 'können',
  'mehr', 'muss', 'müssen', 'nach', 'neue', 'neuen', 'nicht', 'noch', 'nun', 'oder', 'ohne',
  'schon', 'sehr', 'sein', 'seine', 'seinen', 'seit', 'sich', 'sie', 'sind', 'soll', 'sollen',
  'sowie', 'über', 'unter', 'vom', 'von', 'vor', 'wegen', 'weil', 'weiter', 'wenn', 'werden',
  'wieder', 'will', 'wird', 'wurde', 'wurden', 'zum', 'zur', 'zwei', 'drei', 'jahr', 'jahre',
  'jahren', 'prozent', 'sagte', 'sagt', 'laut', 'heißt', 'erste', 'ersten', 'viele', 'einem',
]);

function stem(word: string): string {
  return word.length > 5 ? word.replace(/(en|er|es|em|e|n|s)$/u, '') : word;
}

export function signature(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    if (w.length < 4 || STOPWORDS.has(w)) continue;
    out.add(stem(w));
  }
  return out;
}

export function articleSignature(a: Pick<Article, 'title' | 'blocks'>): Set<string> {
  const first = a.blocks.find((b) => b.type === 'paragraph');
  const lead = first && first.type === 'paragraph' ? (first.sentences[0] ?? '') : '';
  return signature(`${a.title} ${lead}`);
}

export function isSameStory(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared >= 3 && shared / Math.min(a.size, b.size) >= 0.5;
}

/**
 * Fasst gleiche Meldungen zusammen; behalten wird je Gruppe die Fassung mit mehr Text.
 * Die Reihenfolge der Eingabe bleibt erhalten (Platz des ersten Vorkommens).
 */
export function dedupe(articles: Article[]): Article[] {
  const groups: { sig: Set<string>; best: Article; pos: number }[] = [];
  articles.forEach((a, pos) => {
    const sig = articleSignature(a);
    const g = groups.find((x) => isSameStory(x.sig, sig));
    if (!g) groups.push({ sig, best: a, pos });
    else if (a.wordCount > g.best.wordCount) g.best = a;
  });
  return groups.sort((x, y) => x.pos - y.pos).map((g) => g.best);
}
