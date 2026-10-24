export type Messages = Record<string, string>;
export type Params = Record<string, string | number>;

export type Translator = {
  locale: string;
  t(key: string, params?: Params): string;
  /** Plural: sucht `key.one`/`key.other` usw. nach Intl.PluralRules; `count` steht als Parameter bereit. */
  tp(key: string, count: number, params?: Params): string;
};

function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function createTranslator(messages: Messages, locale: string): Translator {
  const plural = new Intl.PluralRules(locale);
  const lookup = (key: string): string => {
    const value = messages[key];
    if (value === undefined) {
      throw new Error(`Fehlender Text in Locale ${locale}: ${key}`);
    }
    return value;
  };
  return {
    locale,
    t: (key, params) => interpolate(lookup(key), params),
    tp: (key, count, params) => {
      const form = plural.select(count);
      const k = `${key}.${form}` in messages ? `${key}.${form}` : `${key}.other`;
      return interpolate(lookup(k), { count, ...params });
    },
  };
}

/** Flacht verschachtelte Locale-JSON zu Punkt-Schlüsseln ab. */
export function flattenMessages(input: unknown, prefix = ''): Messages {
  const out: Messages = {};
  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') out[key] = v;
      else Object.assign(out, flattenMessages(v, key));
    }
  }
  return out;
}
