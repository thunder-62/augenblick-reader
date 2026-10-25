import { describe, expect, it } from 'vitest';
import { packPages } from './paginate.ts';

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
