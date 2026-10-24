/**
 * Tipp-Logik (SPEC §8.1, [R22]): Auslösen beim Loslassen, Berührungen unter 80 ms und
 * ein zweiter Tipp innerhalb von 300 ms ignorieren, Bewegung über 10 mm ist kein Tipp.
 */
import {
  mm,
  TAP_FEEDBACK_MS,
  TAP_MIN_DURATION_MS,
  TAP_MOVE_MM,
  TAP_REPEAT_MS,
} from '@augenblick/shared';

export type TapInput = {
  downAt: number;
  upAt: number;
  dx: number;
  dy: number;
  /** Zeitpunkt des letzten ausgelösten Tipps (beliebiges Ziel) oder null. */
  lastTapAt: number | null;
  /** Losgelassen innerhalb des Ziels? */
  inside: boolean;
};

export function isTap(i: TapInput): boolean {
  if (!i.inside) return false;
  if (i.upAt - i.downAt < TAP_MIN_DURATION_MS) return false;
  if (Math.hypot(i.dx, i.dy) > mm(TAP_MOVE_MM)) return false;
  // Doppeltipps: auch wenn nach dem ersten Tipp ein neuer Bildschirm erscheint,
  // darf der zweite Tipp dort nichts auslösen – deshalb zielübergreifend.
  if (i.lastTapAt !== null && i.downAt - i.lastTapAt < TAP_REPEAT_MS) return false;
  return true;
}

let lastTapAt: number | null = null;

/** Nur für Tests. */
export function resetTapState(): void {
  lastTapAt = null;
}

export function onTap(el: HTMLElement, handler: () => void): void {
  let down: { id: number; t: number; x: number; y: number } | null = null;

  el.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || down) return;
    down = { id: e.pointerId, t: e.timeStamp, x: e.clientX, y: e.clientY };
    // pointerup soll auch kommen, wenn der Finger das Element verlassen hat.
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('pressed');
  });

  const end = (e: PointerEvent, cancelled: boolean): void => {
    if (!down || e.pointerId !== down.id) return;
    const start = down;
    down = null;
    el.classList.remove('pressed');
    if (cancelled || el.getAttribute('aria-disabled') === 'true') return;
    const r = el.getBoundingClientRect();
    const inside =
      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    const ok = isTap({
      downAt: start.t,
      upAt: e.timeStamp,
      dx: e.clientX - start.x,
      dy: e.clientY - start.y,
      lastTapAt,
      inside,
    });
    if (!ok) return;
    lastTapAt = e.timeStamp;
    el.classList.add('tapped');
    setTimeout(() => el.classList.remove('tapped'), TAP_FEEDBACK_MS);
    handler();
  };

  el.addEventListener('pointerup', (e) => end(e, false));
  el.addEventListener('pointercancel', (e) => end(e, true));
  // Tastatur (Barrierefreiheit): Klicks ohne Zeiger haben detail === 0.
  el.addEventListener('click', (e) => {
    e.preventDefault();
    if (e.detail === 0 && el.getAttribute('aria-disabled') !== 'true') handler();
  });
}
