import type { SectionQuota, Settings } from './types.ts';

/** 18 pt in CSS-Pixeln – Untergrenze der Schriftgröße [R1]. */
export const MIN_FONT_SIZE_PX = 24;

/** Rubriken-Mix nach SPEC §5.2. */
export const DEFAULT_SECTIONS: SectionQuota[] = [
  { key: 'region', sections: ['region'], count: 4 },
  { key: 'welt', sections: ['inland', 'ausland', 'wirtschaft'], count: 4 },
  { key: 'vermischtes', sections: ['vermischtes', 'wissen', 'kultur'], count: 2 },
  { key: 'sport', sections: ['sport'], count: 2 },
];

/** Feste Standardwerte bis zur Kalibrierung in M2 (SPEC §7). */
export const DEFAULT_SETTINGS: Settings = {
  fontSizePx: 30,
  lineHeight: 2.0,
  wordSpacingEm: 0.25,
  letterSpacingEm: 0,
  fontFamily: 'atkinson',
  theme: 'dark',
  maxCharsPerLine: 45,
  ttsEnabled: false,
  ttsRate: 0.85,
  ttsVoice: null,
  tickerMode: false,
  lineFocus: false,
  fingerFollow: false,
  locale: 'de',
  sections: DEFAULT_SECTIONS,
};

export const MAX_EDITION_ARTICLES = 12;

/** Erlaubte Bereiche je Einstellung (SPEC §7, [R1]–[R7]). */
export const SETTINGS_LIMITS = {
  fontSizePx: { min: MIN_FONT_SIZE_PX, max: 120, step: 1 },
  lineHeight: { min: 1.2, max: 3, step: 0.1 },
  wordSpacingEm: { min: 0, max: 0.5, step: 0.05 },
  letterSpacingEm: { min: 0, max: 0.05, step: 0.01 },
  maxCharsPerLine: { min: 30, max: 70, step: 1 },
  ttsRate: { min: 0.5, max: 1.5, step: 0.05 },
} as const;

/** Schriftstufen der Kalibrierung: ab 18 pt in Schritten von ca. +26 % (SPEC §8.4, [R1]). */
export const CALIBRATION_SIZES_PX: number[] = Array.from({ length: 7 }, (_, i) =>
  Math.round(MIN_FONT_SIZE_PX * 1.26 ** i),
);

const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function sanitizeSections(v: unknown, fallback: SectionQuota[]): SectionQuota[] {
  if (!Array.isArray(v)) return fallback;
  const out: SectionQuota[] = [];
  for (const q of v.slice(0, 12)) {
    if (!q || typeof q !== 'object') continue;
    const { key, sections, count } = q as Record<string, unknown>;
    const k =
      typeof key === 'string'
        ? key
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
        : '';
    const list = Array.isArray(sections)
      ? sections
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^[a-z0-9-]+$/.test(s))
      : [];
    if (!k || !list.length) continue;
    out.push({
      key: k,
      sections: list,
      count: Math.round(clamp(count, 0, MAX_EDITION_ARTICLES, 0)),
    });
  }
  return out.length ? out : fallback;
}

/**
 * Bringt beliebige Eingaben in gültige Einstellungen: unbekannte Felder fallen weg,
 * Zahlen werden auf die erlaubten Bereiche begrenzt, Fehlendes kommt aus `base`.
 */
export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const L = SETTINGS_LIMITS;
  const round = (n: number, digits: number): number => Number(n.toFixed(digits));
  return {
    fontSizePx: Math.round(
      clamp(i.fontSizePx, L.fontSizePx.min, L.fontSizePx.max, base.fontSizePx),
    ),
    lineHeight: round(clamp(i.lineHeight, L.lineHeight.min, L.lineHeight.max, base.lineHeight), 2),
    wordSpacingEm: round(
      clamp(i.wordSpacingEm, L.wordSpacingEm.min, L.wordSpacingEm.max, base.wordSpacingEm),
      3,
    ),
    letterSpacingEm: round(
      clamp(i.letterSpacingEm, L.letterSpacingEm.min, L.letterSpacingEm.max, base.letterSpacingEm),
      3,
    ),
    fontFamily:
      i.fontFamily === 'mono' || i.fontFamily === 'atkinson' ? i.fontFamily : base.fontFamily,
    theme: i.theme === 'light' || i.theme === 'dark' ? i.theme : base.theme,
    maxCharsPerLine: Math.round(
      clamp(i.maxCharsPerLine, L.maxCharsPerLine.min, L.maxCharsPerLine.max, base.maxCharsPerLine),
    ),
    ttsEnabled: bool(i.ttsEnabled, base.ttsEnabled),
    ttsRate: round(clamp(i.ttsRate, L.ttsRate.min, L.ttsRate.max, base.ttsRate), 2),
    ttsVoice:
      typeof i.ttsVoice === 'string' && i.ttsVoice.trim()
        ? i.ttsVoice.trim().slice(0, 200)
        : i.ttsVoice === null
          ? null
          : base.ttsVoice,
    tickerMode: bool(i.tickerMode, base.tickerMode),
    lineFocus: bool(i.lineFocus, base.lineFocus),
    fingerFollow: bool(i.fingerFollow, base.fingerFollow),
    // Version 1 liefert nur Deutsch (SPEC §11).
    locale: i.locale === 'de' ? 'de' : base.locale,
    sections: sanitizeSections(i.sections, base.sections),
  };
}
