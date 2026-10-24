import { VERSION } from './version.ts';

export const USER_AGENT = `Augenblick/${VERSION} (privater Zeitungs-Reader; +https://github.com/thunder-62/augenblick-reader)`;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} für ${url}`);
  }
}

export async function getText(
  url: string,
  options: { fetch?: FetchLike; timeoutMs?: number; accept?: string } = {},
): Promise<string> {
  const doFetch = options.fetch ?? fetch;
  const res = await doFetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: options.accept ?? '*/*' },
    signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new HttpError(url, res.status);
  return res.text();
}

export async function getJson<T>(
  url: string,
  options: { fetch?: FetchLike; timeoutMs?: number } = {},
): Promise<T> {
  const text = await getText(url, { ...options, accept: 'application/json' });
  return JSON.parse(text) as T;
}
