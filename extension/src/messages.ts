/** Nachrichten zwischen Inhaltsskript, Leseansicht und Hintergrund. */
import type { Block } from '@augenblick/shared';

/** Was die Leseansicht anzeigt; `null`, wenn die Seite sich nicht als Text gewinnen ließ. */
export type PageArticle = { title: string; lang: string; site: string; blocks: Block[] };

/**
 * Inhaltsskript → Leseansicht. Das Kennwort steht nur in der Adresse der Leseansicht (im
 * geschlossenen Shadow DOM), damit die Seite der Leseansicht keinen anderen Text unterschieben kann.
 */
export type ToReader = { type: 'augenblick:article'; token: string; article: PageArticle | null };
/** Leseansicht → Inhaltsskript; geprüft über Absender-Fenster und -Herkunft, ohne Geheimnis. */
export type FromReader = { type: 'augenblick:ready' | 'augenblick:close' };
export type ToContent = { type: 'augenblick:open' };

export const isFromReader = (m: unknown): m is FromReader =>
  typeof m === 'object' &&
  m !== null &&
  ((m as FromReader).type === 'augenblick:ready' || (m as FromReader).type === 'augenblick:close');

export const isToReader = (m: unknown): m is ToReader =>
  typeof m === 'object' &&
  m !== null &&
  (m as ToReader).type === 'augenblick:article' &&
  typeof (m as ToReader).token === 'string';
