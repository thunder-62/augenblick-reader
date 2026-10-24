/**
 * Seitenumbruch ohne Scrollen (SPEC §8.3): Seiten werden so gefüllt, dass nichts abgeschnitten
 * wird, und brechen wenn möglich zwischen Sätzen um – lieber eine Zeile weniger.
 * Rein funktional: `fits` misst, ob eine Seite mit diesen Einträgen passt.
 */
import type { Block } from '@augenblick/shared';

export type PageItem =
  | { kind: 'head' }
  | { kind: 'heading'; block: number }
  /** Sätze [from, to) eines Absatzes. */
  | { kind: 'para'; block: number; from: number; to: number }
  /** Notfall: Wörter [from, to) eines einzelnen, zu langen Satzes. */
  | { kind: 'words'; block: number; sentence: number; from: number; to: number };

export type Page = {
  items: PageItem[];
  /** Fortlaufende Nummer des ersten Satzes auf der Seite (für das Wiederherstellen). */
  anchor: number;
};

export type Fits = (items: PageItem[]) => boolean;

const para = (block: number, from: number, to: number): PageItem => ({
  kind: 'para',
  block,
  from,
  to,
});

export function paginate(blocks: Block[], fits: Fits, withHead = true): Page[] {
  const pages: Page[] = [];
  let cur: PageItem[] = withHead ? [{ kind: 'head' }] : [];
  let pos = 0;
  let curAnchor = 0;
  const newPage = (): void => {
    pages.push({ items: cur, anchor: curAnchor });
    cur = [];
    curAnchor = pos;
  };

  blocks.forEach((block, b) => {
    if (block.type === 'heading') {
      const item: PageItem = { kind: 'heading', block: b };
      const next = blocks[b + 1];
      // Keine Überschrift allein am Seitenende: sie braucht mindestens den ersten Satz danach.
      const probe = next?.type === 'paragraph' ? [item, para(b + 1, 0, 1)] : [item];
      if (cur.length && !fits([...cur, ...probe])) newPage();
      cur.push(item);
      return;
    }
    const n = block.sentences.length;
    let from = 0;
    while (from < n) {
      let best = from;
      if (fits([...cur, para(b, from, n)])) best = n;
      else {
        for (let to = from + 1; to < n; to++) {
          if (fits([...cur, para(b, from, to)])) best = to;
          else break;
        }
      }
      if (best > from) {
        cur.push(para(b, from, best));
        pos += best - from;
        from = best;
        if (from < n) newPage();
        continue;
      }
      if (cur.length) {
        newPage();
        continue;
      }
      // Ein einzelner Satz ist länger als eine ganze Seite: nach Wörtern umbrechen.
      const words = (block.sentences[from] ?? '').split(' ');
      let w = 0;
      while (w < words.length) {
        let end = w;
        for (let e = w + 1; e <= words.length; e++) {
          if (fits([...cur, { kind: 'words', block: b, sentence: from, from: w, to: e }])) end = e;
          else break;
        }
        if (end === w) end = w + 1;
        cur.push({ kind: 'words', block: b, sentence: from, from: w, to: end });
        w = end;
        if (w < words.length) newPage();
      }
      pos += 1;
      from += 1;
    }
  });
  if (cur.length || !pages.length) pages.push({ items: cur, anchor: curAnchor });
  return pages;
}

/** Seite, auf der der Satz `anchor` beginnt; -1 steht für die erste Seite. */
export function pageForAnchor(pages: Page[], anchor: number): number {
  let index = 0;
  pages.forEach((p, i) => {
    if (p.anchor <= anchor && p.items.some((it) => it.kind !== 'head')) index = i;
  });
  return index;
}

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
