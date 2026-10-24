/**
 * Auswahl für die Ausgabe (SPEC §5.2, Schritt 5; §5.3; ADR 003):
 * höchstens 12 Artikel pro Tag, Mischung nach Rubriken-Mix, Dubletten zusammengefasst.
 * Was einmal in der Ausgabe des Tages steht, bleibt drin und behält seinen Platz.
 * Mit Einverständnis rücken gern gelesene Themen nach vorn – ohne zu filtern.
 */
import { MAX_EDITION_ARTICLES, type Article, type SectionQuota } from '@augenblick/shared';
import { articleSignature, dedupe, isSameStory } from './dedupe.ts';

/** Interessen der Nutzerin für die Auswahl (SPEC §5.3). */
export type InterestRanker = {
  score(a: Article): number;
  /** Gehört der Artikel zu einem Lieblingsthema? */
  favorite(a: Article): boolean;
};

/** Die wichtigsten Meldungen des Tages bleiben vorn (SPEC §5.3). */
export const FIXED_TOP = 2;
/** So viele Plätze gehen mindestens an Themen außerhalb der Favoriten (SPEC §5.3). */
export const MIN_OTHER_TOPICS = 3;

const newestFirst = (a: Article, b: Article): number => b.publishedAt.localeCompare(a.publishedAt);

export function selectEdition(
  candidates: Article[],
  existing: Article[],
  quotas: SectionQuota[],
  max = MAX_EDITION_ARTICLES,
  ranker: InterestRanker | null = null,
): string[] {
  const kept = existing.slice(0, max);
  const keptSigs = kept.map(articleSignature);
  const keptIds = new Set(kept.map((a) => a.id));
  const fresh = dedupe([...candidates].sort(newestFirst).filter((a) => !keptIds.has(a.id))).filter(
    (a) => {
      const sig = articleSignature(a);
      return !keptSigs.some((k) => isSameStory(k, sig));
    },
  );
  // Mit Interessen: innerhalb einer Rubrik zuerst, was sie gern liest; sonst das Neueste.
  const byPreference = ranker
    ? [...fresh].sort((a, b) => ranker.score(b) - ranker.score(a) || newestFirst(a, b))
    : fresh;

  const group = (a: Article): number => {
    const i = quotas.findIndex((q) => q.sections.includes(a.section ?? ''));
    return i === -1 ? quotas.length : i;
  };
  const used = new Map<string, number>();
  for (const a of kept) {
    const q = quotas[group(a)];
    if (q) used.set(q.key, (used.get(q.key) ?? 0) + 1);
  }

  const chosen: Article[] = [];
  const room = (): number => max - kept.length - chosen.length;
  for (const q of quotas) {
    for (const a of byPreference) {
      if (room() <= 0 || (used.get(q.key) ?? 0) >= q.count) break;
      if (chosen.includes(a) || !q.sections.includes(a.section ?? '')) continue;
      chosen.push(a);
      used.set(q.key, (used.get(q.key) ?? 0) + 1);
    }
  }
  // Freie Plätze mit den übrigen Artikeln füllen.
  for (const a of byPreference) {
    if (room() <= 0) break;
    if (!chosen.includes(a)) chosen.push(a);
  }

  // Abwechslung: mindestens 3 Plätze für Themen außerhalb der Favoriten (kein Filtern).
  if (ranker) {
    const others = (): number => [...kept, ...chosen].filter((a) => !ranker.favorite(a)).length;
    const spare = fresh.filter((a) => !chosen.includes(a) && !ranker.favorite(a));
    while (others() < MIN_OTHER_TOPICS && spare.length) {
      const replaceable = chosen.filter((a) => ranker.favorite(a));
      if (!replaceable.length) break;
      const weakest = replaceable.reduce((w, a) => (ranker.score(a) < ranker.score(w) ? a : w));
      chosen.splice(chosen.indexOf(weakest), 1, spare.shift() as Article);
    }
  }

  // Redaktionelle Reihenfolge: nach Rubriken-Mix, innerhalb der Rubrik neueste zuerst.
  chosen.sort((a, b) => group(a) - group(b) || newestFirst(a, b));
  if (ranker) {
    // Die ersten Plätze des Tages bleiben redaktionell, der Rest nach Interesse (stabil sortiert).
    const fixed = Math.max(0, FIXED_TOP - kept.length);
    const head = chosen.slice(0, fixed);
    const tail = chosen.slice(fixed).sort((a, b) => ranker.score(b) - ranker.score(a));
    chosen.splice(0, chosen.length, ...head, ...tail);
  }
  return [...kept.map((a) => a.id), ...chosen.map((a) => a.id)];
}
