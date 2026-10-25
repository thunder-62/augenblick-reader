import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor, TEXT_TOKENS, THEMES, type Theme } from '../src/index.ts';

describe('Kontrast (SPEC §14: ≥ 7:1 in beiden Schemata)', () => {
  for (const theme of Object.keys(THEMES) as Theme[]) {
    const c = THEMES[theme];
    for (const token of TEXT_TOKENS) {
      it(`${theme}: ${token} auf Hintergrund ≥ 7:1`, () => {
        expect(contrastRatio(c[token], c.bg)).toBeGreaterThanOrEqual(7);
      });
    }
    it(`${theme}: invertierte Taste (Hintergrund auf Text) ≥ 7:1`, () => {
      expect(contrastRatio(c.bg, c.text)).toBeGreaterThanOrEqual(7);
    });
    it(`${theme}: Rahmen aktiver Tasten ≥ 3:1 (WCAG 1.4.11)`, () => {
      expect(contrastRatio(c.border, c.bg)).toBeGreaterThanOrEqual(3);
    });
  }

  it('entspricht den Kalibrierungsfarben aus SPEC §8.4', () => {
    expect(THEMES.light.text).toBe('#111111');
    expect(THEMES.light.bg).toBe('#FAF7F0');
    expect(THEMES.dark.text).toBe('#F2EAD3');
    expect(THEMES.dark.bg).toBe('#000000');
  });

  it('rechnet bekannte Werte richtig', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
  });
});
