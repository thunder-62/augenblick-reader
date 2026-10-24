import {
  DEFAULT_SETTINGS,
  EDGE_MM,
  mm,
  TAP_GAP_MM,
  TAP_TARGET_MM,
  THEMES,
  type Settings,
} from '@augenblick/shared';

const FONTS: Record<Settings['fontFamily'], string> = {
  atkinson: "'Atkinson Hyperlegible', 'Verdana', sans-serif",
  mono: "'DejaVu Sans Mono', 'Liberation Mono', monospace",
};

/** CSS-Variablen der Lese-Werte; Farben kommen aus shared/theme.ts (CI prüft den Kontrast). */
export function settingsVars(s: Settings): Record<string, string> {
  const colors = THEMES[s.theme] ?? THEMES[DEFAULT_SETTINGS.theme];
  return {
    '--fs': `${s.fontSizePx}px`,
    '--lh': String(s.lineHeight),
    '--ws': `${s.wordSpacingEm}em`,
    '--ls': `${Math.min(0.05, s.letterSpacingEm)}em`,
    '--ff': FONTS[s.fontFamily] ?? FONTS.atkinson,
    '--maxch': String(s.maxCharsPerLine),
    '--tap': `${mm(TAP_TARGET_MM)}px`,
    '--gap': `${mm(TAP_GAP_MM)}px`,
    '--edge': `${mm(EDGE_MM)}px`,
    '--bg': colors.bg,
    '--text': colors.text,
    '--muted': colors.muted,
    '--border': colors.border,
    '--border-inactive': colors.borderInactive,
    '--inactive': colors.inactive,
  };
}

/** Überträgt die Einstellungen auf die ganze Seite. */
export function applySettings(s: Settings): void {
  const root = document.documentElement;
  const colors = THEMES[s.theme] ?? THEMES[DEFAULT_SETTINGS.theme];
  for (const [k, v] of Object.entries(settingsVars(s))) root.style.setProperty(k, v);
  root.dataset.theme = s.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.bg);
}

/** Schlüssel, der sich ändert, wenn ein neuer Seitenumbruch nötig ist. */
export function layoutKey(s: Settings): string {
  return [
    s.fontSizePx,
    s.lineHeight,
    s.wordSpacingEm,
    s.letterSpacingEm,
    s.fontFamily,
    s.maxCharsPerLine,
  ].join('|');
}

/** Durchschnittlicher deutscher Text, um die echte Zeichenbreite zu messen. */
const SAMPLE =
  'Die Stadt hatte das Dach im Frühjahr in Auftrag gegeben. Es soll den Markt vor Regen und starker Sonne schützen. ' +
  'Nach Angaben der Verwaltung kostete der Bau weniger als geplant, und viele Menschen kamen zum Einkaufen.';

/**
 * `maxCharsPerLine` soll echte Zeichen meinen (inkl. Wortabstand), nicht die Breite der Ziffer 0 (CSS-Einheit ch).
 * Setzt --chw auf die gemessene mittlere Zeichenbreite.
 */
export function calibrateCharWidth(): void {
  const probe = document.createElement('span');
  probe.className = 'measure';
  probe.style.whiteSpace = 'nowrap';
  probe.style.width = 'auto';
  probe.style.height = 'auto';
  probe.textContent = SAMPLE;
  document.body.append(probe);
  const width = probe.getBoundingClientRect().width / SAMPLE.length;
  probe.remove();
  if (width > 0) document.documentElement.style.setProperty('--chw', `${width}px`);
}
