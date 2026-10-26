/** Die einzigen Stellen, an denen das Inhaltsskript die WebExtension-Schnittstelle nutzt. */
import type { ToContent } from './messages.ts';

export const readerUrl = (): string => browser.runtime.getURL('reader.html');

/** Ersatzweg über das Firefox-Menü (background.ts). */
export function onOpenRequest(cb: (m: ToContent) => void): void {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== undefined && (message as ToContent | null)?.type === 'augenblick:open')
      cb(message as ToContent);
  });
}
