/** Texte, die der Server selbst ausgibt, kommen ebenfalls aus der Locale (SPEC §11). */
import { createTranslator, flattenMessages } from '@augenblick/shared';
import de from '@augenblick/shared/locales/de.json';

const translator = createTranslator(flattenMessages(de), 'de');

export const serverT = (key: string, params?: Record<string, string | number>): string =>
  translator.t(key, params);
