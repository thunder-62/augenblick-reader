/**
 * Lesesignale für das Interessen-Lernen (SPEC §5.3): beim Verlassen eines Artikels nur
 * „bis zum Ende gelesen?“ und die sichtbare Zeit – kein Leseprotokoll. Der Pi wertet sie
 * nur mit Einverständnis aus.
 */
import { sendReadingSignal } from './api.ts';

type Session = { articleId: string; reachedEnd: boolean; visibleMs: number; since: number | null };

let session: Session | null = null;
let enabled = false;

const now = (): number => performance.now();

export function setSignalsEnabled(on: boolean): void {
  enabled = on;
  if (!on) session = null;
}

/** Artikel verlassen (Übersicht, nächster Artikel, App geschlossen). */
export function endReading(): void {
  if (!session) return;
  const s = session;
  session = null;
  const ms = s.visibleMs + (s.since !== null ? now() - s.since : 0);
  sendReadingSignal({
    articleId: s.articleId,
    reachedEnd: s.reachedEnd,
    seconds: Math.round(ms / 1000),
  });
}

/** Seite im Artikel gezeigt; beginnt bei neuem Artikel eine neue Sitzung. */
export function trackPage(articleId: string, page: number, pagesTotal: number): void {
  if (!enabled) return;
  if (session?.articleId !== articleId) {
    endReading();
    session = {
      articleId,
      reachedEnd: false,
      visibleMs: 0,
      since: document.visibilityState === 'visible' ? now() : null,
    };
  }
  if (page >= pagesTotal - 1) session.reachedEnd = true;
}

document.addEventListener('visibilitychange', () => {
  if (!session) return;
  if (document.visibilityState === 'visible') session.since = now();
  else if (session.since !== null) {
    session.visibleMs += now() - session.since;
    session.since = null;
  }
});
window.addEventListener('pagehide', endReading);
