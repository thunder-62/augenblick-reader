/**
 * Nutzungsprotokoll (SPEC §10): Je gelesenem Artikel gehen höchste Seite, Seitenzahl und
 * sichtbare Lesezeit an den Pi. Nur lokal; der Betreuer kann es im Admin-Bereich abschalten.
 */
import type { UsageEvent } from '@augenblick/shared';

type Session = {
  articleId: string;
  pagesTotal: number;
  pagesSeen: number;
  visibleMs: number;
  since: number | null;
};

let session: Session | null = null;

const now = (): number => performance.now();

function send(event: UsageEvent): void {
  try {
    void fetch('/api/usage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Protokoll ist Nebensache – nie ein Fehler für die Nutzerin.
  }
}

/** Artikel verlassen (Übersicht, nächster Artikel, App geschlossen). */
export function endReading(): void {
  if (!session) return;
  const s = session;
  session = null;
  const ms = s.visibleMs + (s.since !== null ? now() - s.since : 0);
  const seconds = Math.round(ms / 1000);
  // Wer nur kurz hineinschaut, hat nicht gelesen.
  if (seconds < 3) return;
  send({ articleId: s.articleId, pagesSeen: s.pagesSeen, pagesTotal: s.pagesTotal, seconds });
}

/** Seite im Artikel gezeigt; beginnt bei neuem Artikel eine neue Sitzung. */
export function trackPage(articleId: string, page: number, pagesTotal: number): void {
  if (session?.articleId !== articleId) {
    endReading();
    session = {
      articleId,
      pagesTotal,
      pagesSeen: 0,
      visibleMs: 0,
      since: document.visibilityState === 'visible' ? now() : null,
    };
  }
  session.pagesTotal = pagesTotal;
  session.pagesSeen = Math.max(session.pagesSeen, page + 1);
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
