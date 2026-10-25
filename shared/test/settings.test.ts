import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_SIZES_PX,
  DEFAULT_SETTINGS,
  MIN_FONT_SIZE_PX,
  sanitizeSettings,
} from '../src/index.ts';

describe('sanitizeSettings', () => {
  it('lässt gültige Werte unverändert', () => {
    expect(sanitizeSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it('begrenzt auf die erlaubten Bereiche [R1]–[R5]', () => {
    const s = sanitizeSettings({
      fontSizePx: 5,
      letterSpacingEm: 1,
      lineHeight: 9,
      maxCharsPerLine: 200,
      wordSpacingEm: -1,
    });
    expect(s.fontSizePx).toBe(MIN_FONT_SIZE_PX);
    expect(s.letterSpacingEm).toBe(0.05);
    expect(s.lineHeight).toBe(3);
    expect(s.maxCharsPerLine).toBe(70);
    expect(s.wordSpacingEm).toBe(0);
  });

  it('übernimmt Unbekanntes nicht und füllt Fehlendes aus der Basis', () => {
    const s = sanitizeSettings(
      { theme: 'pink', fontFamily: 'Comic', locale: 'en', extra: 1 },
      { ...DEFAULT_SETTINGS, theme: 'light' },
    );
    expect(s.theme).toBe('light');
    expect(s.fontFamily).toBe('atkinson');
    expect(s.locale).toBe('de');
    expect('extra' in s).toBe(false);
  });
});

describe('Kalibrierungsstufen (SPEC §8.4)', () => {
  it('beginnen bei 18 pt und steigen um ca. 26 %', () => {
    expect(CALIBRATION_SIZES_PX[0]).toBe(MIN_FONT_SIZE_PX);
    for (let i = 1; i < CALIBRATION_SIZES_PX.length; i++) {
      const ratio = CALIBRATION_SIZES_PX[i]! / CALIBRATION_SIZES_PX[i - 1]!;
      expect(ratio).toBeGreaterThan(1.2);
      expect(ratio).toBeLessThan(1.32);
    }
  });
});
