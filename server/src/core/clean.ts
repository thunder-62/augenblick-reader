/**
 * Bereinigung auf dem Pi: HTML-Text mit linkedom einlesen, dann die gemeinsame Bereinigung aus
 * `@augenblick/shared/text` (auch von Augenblick für Firefox genutzt, SPEC §16.3).
 */
import { parseHTML } from 'linkedom';
import type { Block } from '@augenblick/shared';
import { elementToBlocks } from '@augenblick/shared/text';

export {
  isNoise,
  MAX_IMAGES,
  MIN_IMAGE_PX,
  paragraph,
  textToBlocks,
  trimTrailingHeadings,
} from '@augenblick/shared/text';

/** Wandelt HTML (Artikelkörper) in Blöcke um; `baseUrl` löst relative Bildadressen auf. */
export function htmlToBlocks(html: string, baseUrl?: string): Block[] {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return elementToBlocks(document.body as unknown as Element, baseUrl);
}
