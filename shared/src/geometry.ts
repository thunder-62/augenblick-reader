/**
 * Maße für Tippziele (SPEC §8.1, [R17]).
 *
 * PX_PER_MM ist ein vorsichtiger Schätzwert aus der Recherche (15–20 mm ≈ 95–125 CSS-px); er macht
 * Tasten eher größer als nötig. Die Schriftgröße stellt die Leserin in der Einführung selbst ein,
 * eine Messung am Gerät ist laut Betreuer nicht nötig.
 */
export const PX_PER_MM = 6.3;

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
