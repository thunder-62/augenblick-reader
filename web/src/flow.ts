/**
 * Bausteine für Einstellungen (SPEC §8.7) und Einführung (§8.8): dieselben Regeln wie beim Lesen –
 * groß, Einzeltipps, Symbol + Wort, höchstens 6 Tippziele, blättern statt scrollen, keine Pop-ups.
 */
import { CALIBRATION_SIZES_PX, type Settings } from '@augenblick/shared';
import { button, fitsIn, h } from './dom.ts';
import { t } from './i18n.ts';
import { splitForSample } from './sample.ts';
import { settingsVars } from './settings.ts';
import { onTap } from './tap.ts';

/** Was die Bildschirme von der App brauchen. */
export type FlowHost = {
  readonly settings: Settings;
  mount(screen: HTMLElement): void;
  showOverview(): void;
  /** Gespeicherte Einstellungen übernehmen (ganze App). */
  applySaved(settings: Settings): Promise<void>;
  /** Sätze eines echten Artikels für die Vorschau (SPEC §8.4, Schritt 3). */
  sampleSentences(): string[];
};

export type Bar = [left: HTMLElement | null, middle: HTMLElement | null, right: HTMLElement | null];

/** Bildschirm mit „◂ Übersicht“-Spalte (oder leer), Inhalt und fester Leiste unten. */
export function flowScreen(opts: {
  rail: HTMLElement | null;
  title?: string;
  progress?: string;
  content: (Node | null)[];
  bar: Bar;
  className?: string;
}): { screen: HTMLElement; page: HTMLElement } {
  const page = h(
    'section',
    { class: 'page flowpage' },
    opts.progress ? h('p', { class: 'meta' }, opts.progress) : null,
    opts.title ? h('h1', { class: 'flowtitle' }, opts.title) : null,
    ...opts.content,
  );
  const [left, middle, right] = opts.bar;
  const screen = h(
    'main',
    { class: `screen article flow ${opts.className ?? ''}`.trim() },
    h('div', { class: 'rail' }, opts.rail),
    page,
    h(
      'nav',
      { class: 'bar' },
      left ?? h('span'),
      middle ?? h('p', { class: 'pageinfo' }),
      right ?? h('span'),
    ),
  );
  return { screen, page };
}

/**
 * Anleitungstext. `optional`: reiner Bedienhinweis, den die beschrifteten Tasten ersetzen –
 * er darf bei sehr großer Schrift entfallen, wenn die Seite sonst überliefe (Auftrag 004, A1).
 */
export function hint(text: string, optional = false): HTMLElement {
  return h('p', { class: optional ? 'flowhint optional' : 'flowhint' }, text);
}

/** Taste mit Tipp-Logik. */
export function tapButton(
  label: string,
  icon: Parameters<typeof button>[1],
  action: () => void,
  cls = '',
): HTMLButtonElement {
  const b = button(label, icon, cls);
  onTap(b, action);
  return b;
}

export function controls(...buttons: (HTMLElement | null)[]): HTMLElement {
  return h('div', { class: 'controls' }, ...buttons);
}

/**
 * Vorschau mit echtem Text in den gewählten Werten (eigene Größe und Farben, unabhängig von der
 * restlichen Seite). `fit()` nach dem Einhängen aufrufen: Es kommen so viele Sätze hinein, wie passen.
 */
export function sampleBox(
  settings: Settings,
  sentences: string[],
): { el: HTMLElement; fit(): void } {
  const el = h('div', { class: 'sample', 'aria-live': 'polite' });
  for (const [k, v] of Object.entries(settingsVars(settings))) el.style.setProperty(k, v);
  const text = h('p', {});
  el.append(text);
  return {
    el,
    fit: () => {
      const parts = splitForSample(sentences);
      // Ganze Sätze, so viele passen; passt nicht einmal der erste, dann Wörter bis „…“.
      text.textContent = '';
      for (const s of parts) {
        const before = text.textContent;
        text.textContent = before ? `${before} ${s}` : s;
        if (fitsIn(el)) continue;
        text.textContent = before;
        break;
      }
      if (text.textContent) return;
      const words = (parts[0] ?? '').split(' ');
      for (let n = words.length - 1; n >= 1; n--) {
        text.textContent = `${words.slice(0, n).join(' ')} …`;
        if (fitsIn(el)) return;
      }
    },
  };
}

/** Index der Kalibrierungsstufe, die der Schriftgröße am nächsten liegt. */
export function nearestStep(px: number): number {
  let best = 0;
  CALIBRATION_SIZES_PX.forEach((s, i) => {
    if (Math.abs(s - px) < Math.abs((CALIBRATION_SIZES_PX[best] ?? 0) - px)) best = i;
  });
  return best;
}

/**
 * Ganzseitiger Bestätigungsschritt (SPEC §8.7): „Soll das ab jetzt immer so bleiben?“ –
 * erst „Ja, so lassen“ speichert. Zeigt die neuen Werte an echtem Text.
 */
export function confirmScreen(
  host: FlowHost,
  opts: {
    description?: string;
    preview?: Settings;
    /** Zusätzliche Taste im Inhalt, z. B. „Eine Stufe größer“ (SPEC §8.4). */
    extra?: HTMLElement;
    onYes: () => Promise<void> | void;
    onNo: () => void;
  },
): void {
  const sample = opts.preview ? sampleBox(opts.preview, host.sampleSentences()) : null;
  let busy = false;
  const yes = tapButton(
    t('confirm.yes'),
    'check',
    () => {
      if (busy) return;
      busy = true;
      void Promise.resolve(opts.onYes()).finally(() => (busy = false));
    },
    'btn-yes',
  );
  const no = tapButton(t('confirm.no'), 'left', opts.onNo, 'btn-no');
  const { screen } = flowScreen({
    rail: tapButton(t('nav.overview'), 'left', () => host.showOverview(), 'btn-overview'),
    title: t('confirm.question'),
    content: [
      opts.description ? hint(opts.description) : null,
      sample?.el ?? null,
      opts.extra ? controls(opts.extra) : null,
    ],
    bar: [no, null, yes],
    className: 'confirm',
  });
  host.mount(screen);
  sample?.fit();
}
