import type {
  Edition,
  Interest,
  IntroState,
  SectionQuota,
  Settings,
  SettingsVersion,
  SourcesConfig,
  TechnikStatus,
} from '@augenblick/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, d.message ?? d.error ?? res.statusText);
  }
  return data as T;
}

export const api = {
  status: () => call<TechnikStatus>('GET', '/api/technik/status'),
  settings: () =>
    call<{ current: Settings; baseline: Settings; history: SettingsVersion[] }>(
      'GET',
      '/api/technik/settings',
    ),
  restore: (id: number) => call<Settings>('POST', '/api/technik/settings/restore', { id }),
  saveSetup: (patch: { salutation?: Settings['salutation']; sections?: SectionQuota[] }) =>
    call<Settings>('PUT', '/api/technik/settings', patch),
  sources: () => call<SourcesConfig>('GET', '/api/technik/sources'),
  saveSources: (s: Partial<SourcesConfig>) => call<SourcesConfig>('PUT', '/api/technik/sources', s),
  interests: () =>
    call<{ enabled: boolean | null; interests: Interest[] }>('GET', '/api/technik/interests'),
  resetIntro: () => call<IntroState>('POST', '/api/technik/intro/reset', {}),
  edition: () => call<Edition>('GET', '/api/edition'),
};
