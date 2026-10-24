import { describe, expect, it } from 'vitest';
import type { Block } from '@augenblick/shared';
import { packPages, pageForAnchor, paginate, type PageItem } from './paginate.ts';

/** Einfaches Modell: Kopf 2 Zeilen, Überschrift 1 Zeile, je Satz eine neue Zeile mit 5 Wörtern pro Zeile. */
function lines(items: PageItem[], blocks: Block[]): number {
  let n = 0;
  for (const it of items) {
    if (it.kind === 'head') n += 2;
    else if (it.kind === 'heading') n += 1;
    else if (it.kind === 'para') {
      const b = blocks[it.block];
      if (b?.type !== 'paragraph') continue;
      for (const s of b.sentences.slice(it.from, it.to)) n += Math.ceil(s.split(' ').length / 5);
    } else n += Math.ceil((it.to - it.from) / 5);
  }
  return n;
}

const para = (count: number, prefix = 'S'): Block => ({
  type: 'paragraph',
  sentences: Array.from({ length: count }, (_, i) => `${prefix}${i + 1}.`),
});

describe('paginate', () => {
  it('bricht zwischen Sätzen um und verliert keinen Satz', () => {
    const blocks: Block[] = [para(3), para(4, 'T'), para(2, 'U')];
    const pages = paginate(blocks, (items) => lines(items, blocks) <= 4);
    const placed = pages.flatMap((p) => p.items).filter((i) => i.kind === 'para');
    const total = placed.reduce((n, i) => n + (i.kind === 'para' ? i.to - i.from : 0), 0);
    expect(total).toBe(9);
    for (const p of pages) expect(lines(p.items, blocks)).toBeLessThanOrEqual(4);
  });

  it('lässt keine Überschrift allein am Seitenende stehen', () => {
    const blocks: Block[] = [para(1), { type: 'heading', text: 'Zwischentitel' }, para(3)];
    const pages = paginate(blocks, (items) => lines(items, blocks) <= 4);
    // Seite 1: Kopf (2) + 1 Satz = 3; Überschrift + Satz würde 5 ergeben → neue Seite.
    expect(pages[0]?.items.map((i) => i.kind)).toEqual(['head', 'para']);
    expect(pages[1]?.items[0]?.kind).toBe('heading');
  });

  it('teilt einen überlangen Satz notfalls nach Wörtern', () => {
    const long = Array.from({ length: 23 }, (_, i) => `w${i}`).join(' ');
    const blocks: Block[] = [{ type: 'paragraph', sentences: [long] }];
    const pages = paginate(blocks, (items) => lines(items, blocks) <= 2, false);
    const words = pages
      .flatMap((p) => p.items)
      .reduce((n, i) => n + (i.kind === 'words' ? i.to - i.from : 0), 0);
    expect(words).toBe(23);
    expect(pages.length).toBe(3);
  });

  it('merkt sich den ersten Satz je Seite und findet die Seite wieder', () => {
    const blocks: Block[] = [para(3), para(3, 'T')];
    const pages = paginate(blocks, (items) => lines(items, blocks) <= 3);
    expect(pages.map((p) => p.anchor)).toEqual([0, 1, 4]);
    expect(pageForAnchor(pages, -1)).toBe(0);
    expect(pageForAnchor(pages, 2)).toBe(1);
    expect(pageForAnchor(pages, 5)).toBe(2);
  });

  it('liefert für leere Artikel eine Seite mit Titel', () => {
    const pages = paginate([], () => true);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.items).toEqual([{ kind: 'head' }]);
  });
});

describe('packPages', () => {
  it('höchstens drei je Seite, weniger wenn sie nicht passen', () => {
    const heights = [1, 1, 1, 1, 3, 2, 2];
    const pages = packPages(heights, 3, (g) => g.reduce((a, b) => a + b, 0) <= 4);
    expect(pages).toEqual([
      [1, 1, 1],
      [1, 3],
      [2, 2],
    ]);
  });
});
