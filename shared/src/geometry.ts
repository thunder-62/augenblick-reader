/**
 * Maße für Tippziele (SPEC §8.1, [R17]).
 *
 * PX_PER_MM aus dem Datenblatt des Galaxy Tab S11 (11 Zoll, 2560 × 1600 px, in Chrome 1280 × 800
 * CSS-px): Breite ≈ 237 mm → ≈ 5,4 CSS-px/mm. Der frühere Schätzwert 6,3 machte die Tasten am
 * Gerät rund 23 statt 20 mm hoch (Foto vom 25.10.2026; Auftrag 005, ADR 017).
 */
export const PX_PER_MM = 5.4;

export const TAP_MIN_MM = 15;
export const TAP_TARGET_MM = 20;
export const TAP_GAP_MM = 6;
export const EDGE_MM = 15;
/** Bewegung, ab der eine Berührung kein Tipp mehr ist. */
export const TAP_MOVE_MM = 10;
/** Kürzere Berührungen werden ignoriert. */
export const TAP_MIN_DURATION_MS = 80;
/** Zweiter Tipp auf dasselbe Ziel innerhalb dieser Zeit wird ignoriert. */
export const TAP_REPEAT_MS = 300;
/** Dauer des visuellen Feedbacks. */
export const TAP_FEEDBACK_MS = 150;
/** Höchstens so viele Tippziele pro Bildschirm [R18]. */
export const MAX_TAP_TARGETS = 6;

export const mm = (value: number): number => Math.round(value * PX_PER_MM);
