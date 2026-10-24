import type { Article, Edition, Settings } from '@augenblick/shared';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

export const fetchEdition = (): Promise<Edition> => get<Edition>('/api/edition');
export const fetchSettings = (): Promise<Settings> => get<Settings>('/api/settings');

/** null, wenn es den Artikel nicht (mehr) gibt. */
export async function fetchArticle(id: string): Promise<Article | null> {
  const res = await fetch(`/api/articles/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} Artikel ${id}`);
  return (await res.json()) as Article;
}
