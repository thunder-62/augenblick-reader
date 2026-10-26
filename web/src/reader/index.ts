/**
 * Gemeinsamer Lese-Baustein (ADR 023) für die Pi-Web-App und Augenblick für Firefox:
 * Leseansicht, Schrift- und Farbwerte, Tipp-Logik, DOM-Bau, Texte und Wake Lock.
 * Die Styles liegen daneben in `reader.css`.
 */
export { glue, readingView, renderProse } from './view.ts';
export type { ReadingDoc, ReadingOptions, ReadingView } from './view.ts';
export { h, icons, roundButton } from '../dom.ts';
export { onTap } from '../tap.ts';
export { applySettings, calibrateCharWidth, settingsVars } from '../settings.ts';
export { setLocale, t } from '../i18n.ts';
export { keepAwake } from '../wakelock.ts';
