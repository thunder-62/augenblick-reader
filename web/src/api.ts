import type {
  Article,
  Edition,
  Interest,
  IntroState,
  ReadingSignal,
  Settings,
  SettingsSource,
} from '@augenblick/shared';

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

const get = <T>(url: string): Promise<T> => call<T>('GET', url);

export const fetchEdition = (): Promise<Edition> => get<Edition>('/api/edition');
export const fetchSettings = (): Promise<Settings> => get<Settings>('/api/settings');
export const fetchBaseline = (): Promise<Settings> => get<Settings>('/api/settings/baseline');

/** Speichert erst nach der Rückfrage „Soll das ab jetzt immer so bleiben?“ (SPEC §8.7). */
export const saveSettings = (
  settings: Partial<Settings>,
  source: SettingsSource,
): Promise<Settings> => call<Settings>('PUT', '/api/settings', { settings, source });

export const fetchIntro = (): Promise<IntroState> => get<IntroState>('/api/intro');
export const saveIntro = (intro: IntroState): Promise<IntroState> =>
  call<IntroState>('PUT', '/api/intro', intro);

export const fetchInterests = (): Promise<Interest[]> => get<Interest[]>('/api/interests');
export const saveInterests = (change: {
  adjust?: Record<string, number>;
  forgetAll?: boolean;
}): Promise<Interest[]> => call<Interest[]>('PUT', '/api/interests', change);

/** Lesesignal für das Interessen-Lernen; Fehler sind Nebensache. */
export function sendReadingSignal(signal: ReadingSignal): void {
  try {
    void fetch('/api/reading', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(signal),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // nie ein Fehler für die Nutzerin
  }
}

/** null, wenn es den Artikel nicht (mehr) gibt. */
export async function fetchArticle(id: string): Promise<Article | null> {
  const res = await fetch(`/api/articles/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} Artikel ${id}`);
  return (await res.json()) as Article;
}
