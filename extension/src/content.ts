/**
 * Inhaltsskript von Augenblick für Firefox (SPEC §16.1–16.4): blendet auf lesbaren Seiten die
 * Taste „Lesen“ ein und öffnet die Leseansicht. Seiten, die Inhalte nachladen, werden gedrosselt
 * erneut geprüft.
 */
import { createReadButton } from './button.ts';
import { canRead, extractArticle } from './extract.ts';
import type { PageArticle, ToContent } from './messages.ts';
import { createOverlay } from './overlay.ts';
import { readerUrl, onOpenRequest } from './runtime.ts';

/** Höchstens so oft wird die Seite nach Änderungen neu geprüft. */
const RECHECK_MS = 1000;

function extract(): PageArticle | null {
  try {
    return extractArticle(document);
  } catch {
    // Kaputte oder ungewöhnliche Seite: ruhiger Hinweis in der Leseansicht.
    return null;
  }
}

function start(): void {
  const open = (): void => {
    button.show(false);
    overlay.open(extract());
  };
  const button = createReadButton(open);
  const overlay = createOverlay(readerUrl(), () => check());

  const check = (): void => {
    if (overlay.isOpen()) return;
    let readable: boolean;
    try {
      readable = canRead(document);
    } catch {
      readable = false;
    }
    button.show(readable);
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (): void => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      check();
    }, RECHECK_MS);
  };
  new MutationObserver((records) => {
    // Eigene Elemente lösen keine neue Prüfung aus.
    if (records.every((r) => [...r.addedNodes, ...r.removedNodes].every(isOwn))) return;
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);

  onOpenRequest((m: ToContent) => {
    if (m.type === 'augenblick:open' && !overlay.isOpen()) open();
  });
  check();
}

const isOwn = (n: Node): boolean =>
  n instanceof Element &&
  (n.localName === 'augenblick-lesen' || n.localName === 'augenblick-ansicht');

// Nur im obersten Fenster, nicht in eingebetteten Rahmen (Werbung, Videos).
if (window.top === window) start();
