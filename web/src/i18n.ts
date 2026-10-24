import { createTranslator, flattenMessages } from '@augenblick/shared';
import de from '@augenblick/shared/locales/de.json';

const LOCALES: Record<string, unknown> = { de };

export let i18n = createTranslator(flattenMessages(de), 'de');

export function setLocale(locale: string): void {
  const messages = LOCALES[locale] ?? de;
  i18n = createTranslator(flattenMessages(messages), LOCALES[locale] ? locale : 'de');
  document.documentElement.lang = i18n.locale;
}

export const t = (key: string, params?: Record<string, string | number>): string =>
  i18n.t(key, params);
export const tp = (key: string, count: number): string => i18n.tp(key, count);

/** Text mit Rückfall, z. B. für unbekannte Rubriken. */
export function tOr(key: string, fallbackKey: string): string {
  try {
    return i18n.t(key);
  } catch {
    return i18n.t(fallbackKey);
  }
}
