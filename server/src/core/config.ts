import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SECTIONS,
  DEFAULT_SETTINGS,
  MIN_FONT_SIZE_PX,
  type SectionQuota,
  type Settings,
  type Theme,
} from '@augenblick/shared';

export type Config = {
  dataDir: string;
  dbPath: string;
  host: string;
  port: number;
  webDist: string | null;
  tagesschauBaseUrl: string;
  /** Höchstens so viele Abrufe pro Stunde (Nutzungsbedingungen: < 60). */
  tagesschauHourlyLimit: number;
  br24FeedUrl: string;
  /** Höchstens so viele Artikelseiten pro Lauf und Quelle. */
  maxArticlesPerRun: number;
  fetchOnStart: boolean;
  retentionDays: number;
  settings: Settings;
};

/** Lädt `.env` aus dem Arbeitsverzeichnis bzw. dem Repo-Wurzelverzeichnis, falls vorhanden. */
export function loadEnvFile(): void {
  const candidates = [path.resolve('.env'), path.resolve('..', '.env')];
  for (const file of candidates) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'ja', 'yes', 'on'].includes(value.trim().toLowerCase());
}

/** Rubriken-Mix im Format `region=region:4;welt=inland,ausland,wirtschaft:4`. */
export function parseSections(value: string | undefined): SectionQuota[] {
  if (!value?.trim()) return DEFAULT_SECTIONS;
  const out: SectionQuota[] = [];
  for (const part of value.split(';')) {
    const m = /^\s*([\w-]+)\s*=\s*([\w,\s-]+):\s*(\d+)\s*$/.exec(part);
    if (!m?.[1] || !m[2] || !m[3])
      throw new Error(`AUGENBLICK_SECTIONS: ungültiger Eintrag „${part}“`);
    out.push({
      key: m[1],
      sections: m[2]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      count: Number(m[3]),
    });
  }
  return out;
}

function findWebDist(): string | null {
  const candidates = [
    process.env.AUGENBLICK_WEB_DIST,
    path.resolve('web/dist'),
    path.resolve('../web/dist'),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => existsSync(path.join(p, 'index.html'))) ?? null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dataDir = path.resolve(env.AUGENBLICK_DATA_DIR ?? 'data');
  const theme: Theme = env.AUGENBLICK_THEME === 'light' ? 'light' : 'dark';
  const fontSizePx = Math.max(
    MIN_FONT_SIZE_PX,
    num(env.AUGENBLICK_FONT_SIZE_PX, DEFAULT_SETTINGS.fontSizePx),
  );
  return {
    dataDir,
    dbPath: path.join(dataDir, 'augenblick.sqlite'),
    host: env.HOST ?? '127.0.0.1',
    port: num(env.PORT, 8080),
    webDist: findWebDist(),
    tagesschauBaseUrl: (env.TAGESSCHAU_BASE_URL ?? 'https://www.tagesschau.de/api2u').replace(
      /\/+$/,
      '',
    ),
    tagesschauHourlyLimit: Math.min(55, num(env.TAGESSCHAU_HOURLY_LIMIT, 50)),
    br24FeedUrl: env.BR24_FEED_URL ?? 'https://feeds.br24.de/rss/nachrichten',
    maxArticlesPerRun: num(env.AUGENBLICK_MAX_ARTICLES_PER_RUN, 20),
    fetchOnStart: bool(env.AUGENBLICK_FETCH_ON_START, true),
    retentionDays: num(env.AUGENBLICK_RETENTION_DAYS, 7),
    settings: {
      ...DEFAULT_SETTINGS,
      theme,
      fontSizePx,
      sections: parseSections(env.AUGENBLICK_SECTIONS),
    },
  };
}
