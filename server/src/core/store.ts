/** Einstellungen, Konfiguration und Nutzungsprotokoll in der Datenbank (M2). */
import {
  sanitizeSettings,
  type Settings,
  type SourcesConfig,
  type UsageDay,
  type UsageEvent,
} from '@augenblick/shared';
import type { Db } from './db.ts';
import { berlinDay } from './time.ts';

/** Version 1 kennt ein Gerät; die Tabelle ist für mehrere vorbereitet (SPEC §12a). */
export const DEFAULT_DEVICE = 'standard';

export function getSettings(db: Db, defaults: Settings, device = DEFAULT_DEVICE): Settings {
  const row = db.prepare('SELECT json FROM settings WHERE device = ?').get(device) as
    { json: string } | undefined;
  if (!row) return defaults;
  try {
    return sanitizeSettings(JSON.parse(row.json), defaults);
  } catch {
    return defaults;
  }
}

export function saveSettings(
  db: Db,
  input: unknown,
  defaults: Settings,
  now: string,
  device = DEFAULT_DEVICE,
): Settings {
  const settings = sanitizeSettings(input, getSettings(db, defaults, device));
  db.prepare(
    `INSERT INTO settings (device, json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(device) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
  ).run(device, JSON.stringify(settings), now);
  return settings;
}

export function getConfig(db: Db, key: string): string | null {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
    { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(db: Db, key: string, value: string): void {
  db.prepare(
    'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}

export type SourcesDefaults = { br24FeedUrl: string };

export function getSourcesConfig(db: Db, defaults: SourcesDefaults): SourcesConfig {
  return {
    br24FeedUrl: getConfig(db, 'br24_feed_url') ?? defaults.br24FeedUrl,
    usageLogEnabled: getConfig(db, 'usage_log_enabled') !== 'false',
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Speichert geänderte Felder; ungültige Feed-URLs werden abgewiesen. */
export function saveSourcesConfig(
  db: Db,
  input: unknown,
  defaults: SourcesDefaults,
): SourcesConfig {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  if (typeof i.br24FeedUrl === 'string') {
    const url = i.br24FeedUrl.trim();
    if (!isHttpUrl(url))
      throw new Error('Die Feed-Adresse muss mit http:// oder https:// beginnen.');
    setConfig(db, 'br24_feed_url', url);
  }
  if (typeof i.usageLogEnabled === 'boolean')
    setConfig(db, 'usage_log_enabled', String(i.usageLogEnabled));
  return getSourcesConfig(db, defaults);
}

/** Prüft eine Meldung vom Tablet; null, wenn sie unbrauchbar ist. */
export function parseUsageEvent(input: unknown): UsageEvent | null {
  if (!input || typeof input !== 'object') return null;
  const i = input as Record<string, unknown>;
  const int = (v: unknown, max: number): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.round(v)) : null;
  const articleId =
    typeof i.articleId === 'string' && /^[a-z0-9-]{1,120}$/.test(i.articleId) ? i.articleId : null;
  const pagesTotal = int(i.pagesTotal, 500);
  const pagesSeen = int(i.pagesSeen, 500);
  // Mehr als 2 Stunden an einem Artikel ist kein Lesen mehr, sondern ein liegengelassenes Tablet.
  const seconds = int(i.seconds, 2 * 60 * 60);
  if (!articleId || pagesTotal === null || pagesSeen === null || seconds === null) return null;
  return { articleId, pagesTotal, pagesSeen: Math.min(pagesSeen, pagesTotal), seconds };
}

export function logUsage(db: Db, e: UsageEvent, now: Date): void {
  db.prepare(
    'INSERT INTO usage_log (at, day, article_id, pages_seen, pages_total, seconds) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(now.toISOString(), berlinDay(now), e.articleId, e.pagesSeen, e.pagesTotal, e.seconds);
}

/** Zusammenfassung je Tag, neueste zuerst. */
export function usageByDay(db: Db, days: number): UsageDay[] {
  const rows = db
    .prepare(
      `SELECT day, COUNT(DISTINCT article_id) AS articles, SUM(pages_seen) AS pages, SUM(seconds) AS seconds
       FROM usage_log GROUP BY day ORDER BY day DESC LIMIT ?`,
    )
    .all(days) as { day: string; articles: number; pages: number; seconds: number }[];
  return rows.map((r) => ({
    day: r.day,
    articles: r.articles,
    pages: r.pages,
    minutes: Math.round(r.seconds / 60),
  }));
}

export function deleteUsage(db: Db): number {
  return db.prepare('DELETE FROM usage_log').run().changes;
}

/** Protokoll nicht ewig aufheben: Einträge älter als `days` Tage löschen. */
export function pruneUsage(db: Db, now: Date, days: number): number {
  const cutoff = berlinDay(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  return db.prepare('DELETE FROM usage_log WHERE day < ?').run(cutoff).changes;
}

export function articleCounts(db: Db): { total: number; ready: number; failed: number } {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(status = 'ready') AS ready, SUM(status = 'failed') AS failed FROM articles`,
    )
    .get() as { total: number; ready: number | null; failed: number | null };
  return { total: r.total, ready: r.ready ?? 0, failed: r.failed ?? 0 };
}
