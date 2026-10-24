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
