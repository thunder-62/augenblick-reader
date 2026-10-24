/**
 * Auswahl für die Ausgabe (SPEC §5.2, Schritt 5; ADR 003):
 * höchstens 12 Artikel pro Tag, Mischung nach Rubriken-Mix, Dubletten zusammengefasst.
 * Was einmal in der Ausgabe des Tages steht, bleibt drin und behält seinen Platz.
 */
import { MAX_EDITION_ARTICLES, type Article, type SectionQuota } from '@augenblick/shared';
import { articleSignature, dedupe, isSameStory } from './dedupe.ts';

function quotaOf(a: Article, quotas: SectionQuota[]): SectionQuota | undefined {
  return quotas.find((q) => q.sections.includes(a.section ?? ''));
}

export function selectEdition(
  candidates: Article[],
  existing: Article[],
  quotas: SectionQuota[],
  max = MAX_EDITION_ARTICLES,
): string[] {
  const kept = existing.slice(0, max);
  const keptSigs = kept.map(articleSignature);
  const keptIds = new Set(kept.map((a) => a.id));
  const byNewest = [...candidates].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const fresh = dedupe(byNewest.filter((a) => !keptIds.has(a.id))).filter((a) => {
    const sig = articleSignature(a);
    return !keptSigs.some((k) => isSameStory(k, sig));
  });

  const used = new Map<string, number>();
  for (const a of kept) {
    const q = quotaOf(a, quotas);
    if (q) used.set(q.key, (used.get(q.key) ?? 0) + 1);
  }

  const chosen: Article[] = [];
  const room = (): number => max - kept.length - chosen.length;
  for (const q of quotas) {
    for (const a of fresh) {
      if (room() <= 0 || (used.get(q.key) ?? 0) >= q.count) break;
      if (chosen.includes(a) || !q.sections.includes(a.section ?? '')) continue;
      chosen.push(a);
      used.set(q.key, (used.get(q.key) ?? 0) + 1);
    }
  }
  // Freie Plätze mit den neuesten übrigen Artikeln füllen.
  for (const a of fresh) {
    if (room() <= 0) break;
    if (!chosen.includes(a)) chosen.push(a);
  }

  // Neue Artikel nach Rubriken-Reihenfolge, innerhalb der Rubrik neueste zuerst.
  const order = (a: Article): number => {
    const i = quotas.findIndex((q) => q.sections.includes(a.section ?? ''));
    return i === -1 ? quotas.length : i;
  };
  chosen.sort((a, b) => order(a) - order(b) || b.publishedAt.localeCompare(a.publishedAt));
  return [...kept.map((a) => a.id), ...chosen.map((a) => a.id)];
}
