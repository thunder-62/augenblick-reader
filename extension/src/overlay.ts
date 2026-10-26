/**
 * Leseansicht über der Seite (SPEC §16.4): eine Erweiterungsseite im Vollbild-iframe, im
 * geschlossenen Shadow DOM. Die Seite darunter bleibt unverändert und behält ihre Scrollposition.
 * Die Zurück-Geste schließt die Ansicht: Beim Öffnen kommt ein Eintrag in den Verlauf.
 */
import { DEFAULT_SETTINGS, THEMES } from '@augenblick/shared';
import { TOP_Z } from './button.ts';
import { isFromReader, type PageArticle, type ToReader } from './messages.ts';

export type Overlay = { open: (article: PageArticle | null) => void; isOpen: () => boolean };

export function createOverlay(readerUrl: string, onClosed: () => void): Overlay {
  const readerOrigin = new URL(readerUrl).origin;
  let current: {
    host: HTMLElement;
    frame: HTMLIFrameElement;
    token: string;
    scroll: [number, number];
    onMessage: (e: MessageEvent) => void;
    onPop: () => void;
  } | null = null;

  const remove = (): void => {
    const c = current;
    if (!c) return;
    current = null;
    window.removeEventListener('message', c.onMessage);
    window.removeEventListener('popstate', c.onPop);
    c.host.remove();
    // Falls die Seite unter der Ansicht doch gescrollt hat: zurück an die alte Stelle.
    window.scrollTo(c.scroll[0], c.scroll[1]);
    onClosed();
  };

  /** Schließen über den Knopf: den eigenen Verlaufseintrag wieder entfernen. */
  const close = (): void => {
    if (!current) return;
    if ((history.state as { augenblick?: string } | null)?.augenblick === current.token)
      history.back(); // löst popstate aus → remove()
    else remove();
  };

  const open = (article: PageArticle | null): void => {
    if (current) return;
    const token = crypto.randomUUID();
    const host = document.createElement('augenblick-ansicht');
    host.style.cssText = `position:fixed;inset:0;z-index:${TOP_Z};display:block;margin:0;padding:0;`;
    const shadow = host.attachShadow({ mode: 'closed' });
    const frame = document.createElement('iframe');
    frame.src = `${readerUrl}#${token}`;
    frame.setAttribute('allow', 'screen-wake-lock');
    frame.style.cssText = `border:0;width:100%;height:100%;display:block;background:${THEMES[DEFAULT_SETTINGS.theme].bg};`;
    shadow.append(frame);

    const onMessage = (e: MessageEvent): void => {
      // Nur die eigene Leseansicht: die Seite kann weder Absender noch Herkunft fälschen.
      if (!current || e.source !== frame.contentWindow || e.origin !== readerOrigin) return;
      if (!isFromReader(e.data)) return;
      if (e.data.type === 'augenblick:ready') {
        const msg: ToReader = { type: 'augenblick:article', token, article };
        frame.contentWindow?.postMessage(msg, readerOrigin);
        frame.focus();
      } else close();
    };
    const onPop = (): void => {
      if ((history.state as { augenblick?: string } | null)?.augenblick !== token) remove();
    };
    current = { host, frame, token, scroll: [window.scrollX, window.scrollY], onMessage, onPop };
    window.addEventListener('message', onMessage);
    window.addEventListener('popstate', onPop);
    // Den Zustand der Seite mitnehmen, damit ihr eigener Router den Eintrag nicht missversteht.
    // Klappt das nicht (fremder Zustand, den das Inhaltsskript nicht lesen kann), nur der eigene.
    let state: Record<string, unknown> = { augenblick: token };
    try {
      const prev: unknown = history.state;
      if (typeof prev === 'object' && prev !== null) state = { ...prev, augenblick: token };
    } catch {
      // bleibt beim eigenen Zustand
    }
    history.pushState(state, '');
    document.documentElement.append(host);
  };

  return { open, isOpen: () => current !== null };
}
