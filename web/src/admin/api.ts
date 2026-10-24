import type { AdminStatus, Edition, Settings, SourcesConfig, UsageDay } from '@augenblick/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: 'text', message: text };
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(
      res.status,
      d.error ?? String(res.status),
      d.message ?? d.error ?? res.statusText,
    );
  }
  return data as T;
}

export const api = {
  session: () => call<{ ok: true }>('GET', '/api/admin/session'),
  login: (pin: string) => call<{ ok: true }>('POST', '/api/admin/login', { pin }),
  logout: () => call<{ ok: true }>('POST', '/api/admin/logout', {}),
  status: () => call<AdminStatus>('GET', '/api/admin/status'),
  settings: () => call<{ settings: Settings; defaults: Settings }>('GET', '/api/admin/settings'),
  saveSettings: (s: Partial<Settings>) => call<Settings>('PUT', '/api/admin/settings', s),
  calibrate: (fontSizePx: number, theme: Settings['theme']) =>
    call<Settings>('POST', '/api/admin/calibration', { fontSizePx, theme }),
  sources: () => call<SourcesConfig>('GET', '/api/admin/sources'),
  saveSources: (s: Partial<SourcesConfig>) => call<SourcesConfig>('PUT', '/api/admin/sources', s),
  usage: () => call<{ enabled: boolean; days: UsageDay[] }>('GET', '/api/admin/usage'),
  deleteUsage: () => call<{ deleted: number }>('DELETE', '/api/admin/usage'),
  edition: () => call<Edition>('GET', '/api/edition'),
};
