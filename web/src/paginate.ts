/**
 * Bausteine eines Artikels für die Darstellung und das Verteilen von Karten auf Seiten.
 * Der Artikel selbst ist seit Auftrag 006 Fließtext zum Scrollen (ADR 018), ohne Seitenumbruch.
 */

export type PageItem =
  | { kind: 'head' }
  | { kind: 'heading'; block: number }
  /** Sätze [from, to) eines Absatzes. */
  | { kind: 'para'; block: number; from: number; to: number }
  /** Notfall: Wörter [from, to) eines einzelnen, zu langen Satzes. */
  | { kind: 'words'; block: number; sentence: number; from: number; to: number };

/** Packt Elemente (z. B. Karten) gierig auf Seiten, höchstens `max` je Seite. */
export function packPages<T>(items: T[], max: number, fits: (group: T[]) => boolean): T[][] {
  const pages: T[][] = [];
  let cur: T[] = [];
  for (const item of items) {
    if (cur.length && (cur.length >= max || !fits([...cur, item]))) {
      pages.push(cur);
      cur = [];
    }
    cur.push(item);
  }
  if (cur.length) pages.push(cur);
  return pages;
}
