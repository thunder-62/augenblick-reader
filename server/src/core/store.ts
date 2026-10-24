/** Einstellungen mit Verlauf, Einführung, Quellen und gelernte Interessen in der Datenbank. */
import {
  sanitizeSettings,
  type Article,
  type Interest,
  type IntroState,
  type ReadingSignal,
  type Settings,
  type SettingsSource,
  type SettingsVersion,
  type SourcesConfig,
} from '@augenblick/shared';
import de from '@augenblick/shared/locales/de.json';
import { isHttpUrl, normalizeFeedList, resolveFeed } from '../sources/feeds.ts';
import type { InterestRanker } from './selection.ts';
import type { Db } from './db.ts';

/** Version 1 kennt ein Gerät; die Tabellen sind für mehrere vorbereitet (SPEC §12a). */
export const DEFAULT_DEVICE = 'standard';

// --- Einstellungen ------------------------------------------------------------

/** Was die Nutzerin selbst ändern darf (SPEC §8.7) – keine Technik wie Quellen oder Rubriken. */
export const USER_KEYS = [
  'fontSizePx',
  'lineHeight',
  'wordSpacingEm',
  'letterSpacingEm',
  'fontFamily',
  'theme',
  'maxCharsPerLine',
  'ttsEnabled',
  'ttsRate',
  'ttsVoice',
  'interestLearning',
] as const satisfies readonly (keyof Settings)[];

/** Was „Wie am Anfang“ zurückholt: die Lese-Werte, nicht Einverständnis oder Technik. */
const READING_KEYS = USER_KEYS.filter((k) => k !== 'interestLearning');

export function pick(input: unknown, keys: readonly string[]): Record<string, unknown> {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return Object.fromEntries(keys.filter((k) => k in i).map((k) => [k, i[k]]));
}

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

/** Speichert geänderte Felder und legt eine Fassung im Verlauf ab. */
export function saveSettings(
  db: Db,
  input: unknown,
  defaults: Settings,
  now: string,
  source: SettingsSource,
  device = DEFAULT_DEVICE,
): Settings {
  const settings = sanitizeSettings(input, getSettings(db, defaults, device));
  const json = JSON.stringify(settings);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO settings (device, json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(device) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
    ).run(device, json, now);
    db.prepare(
      'INSERT INTO settings_history (device, saved_at, source, json) VALUES (?, ?, ?, ?)',
    ).run(device, now, source, json);
  })();
  return settings;
}

export function settingsHistory(
  db: Db,
  defaults: Settings,
  limit = 30,
  device = DEFAULT_DEVICE,
): SettingsVersion[] {
  const rows = db
    .prepare('SELECT * FROM settings_history WHERE device = ? ORDER BY id DESC LIMIT ?')
    .all(device, limit) as { id: number; saved_at: string; source: SettingsSource; json: string }[];
  return rows.map((r) => ({
    id: r.id,
    savedAt: r.saved_at,
    source: r.source,
    settings: sanitizeSettings(JSON.parse(r.json), defaults),
  }));
}

/** Zurück auf eine frühere Fassung (Technik-Bereich, SPEC §10) – als neue Fassung gespeichert. */
export function restoreVersion(
  db: Db,
  id: number,
  defaults: Settings,
  now: string,
  device = DEFAULT_DEVICE,
): Settings | null {
  const row = db
    .prepare('SELECT json FROM settings_history WHERE id = ? AND device = ?')
    .get(id, device) as { json: string } | undefined;
  if (!row) return null;
  return saveSettings(db, JSON.parse(row.json), defaults, now, 'technik', device);
}

/**
 * „Wie am Anfang“ (SPEC §8.7): die zuletzt gemeinsam kalibrierten Lese-Werte (aus Einführung oder
 * „Schrift einstellen“), sonst die Anfangswerte. Einverständnis, Anrede und Technik bleiben.
 */
export function baselineSettings(db: Db, defaults: Settings, device = DEFAULT_DEVICE): Settings {
  const current = getSettings(db, defaults, device);
  const row = db
    .prepare(
      `SELECT json FROM settings_history WHERE device = ? AND source IN ('kalibrierung', 'einfuehrung')
       ORDER BY id DESC LIMIT 1`,
    )
    .get(device) as { json: string } | undefined;
  const base = row ? sanitizeSettings(JSON.parse(row.json), defaults) : defaults;
  return { ...current, ...pick(base, READING_KEYS) } as Settings;
}

// --- Konfiguration --------------------------------------------------------------

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

// --- Einführung -----------------------------------------------------------------

export function getIntro(db: Db, device = DEFAULT_DEVICE): IntroState {
  try {
    const raw = getConfig(db, `intro:${device}`);
    if (raw) return parseIntro(JSON.parse(raw)) ?? { state: 'neu', step: 1 };
  } catch {
    // unlesbar: neu beginnen
  }
  return { state: 'neu', step: 1 };
}

export function parseIntro(input: unknown): IntroState | null {
  if (!input || typeof input !== 'object') return null;
  const { state, step } = input as Record<string, unknown>;
  if (state !== 'neu' && state !== 'pausiert' && state !== 'fertig') return null;
  const n = typeof step === 'number' && Number.isFinite(step) ? Math.round(step) : 1;
  return { state, step: Math.min(20, Math.max(1, n)) };
}

export function setIntro(db: Db, intro: IntroState, device = DEFAULT_DEVICE): void {
  setConfig(db, `intro:${device}`, JSON.stringify(intro));
}

// --- Quellen ----------------------------------------------------------------------

export type SourcesDefaults = { rssFeeds: readonly string[] };

/**
 * Aktive Feeds: im Technik-Bereich gespeicherte Liste, sonst die aus der Umgebung.
 * Aus M1 übernommen: eine dort gespeicherte einzelne BR24-Adresse gilt als Liste mit einem Eintrag.
 */
export function getSourcesConfig(db: Db, defaults: SourcesDefaults): SourcesConfig {
  const raw = getConfig(db, 'rss_feeds');
  if (raw) {
    try {
      return { feeds: normalizeFeedList(JSON.parse(raw)) };
    } catch {
      // unlesbar: Standard verwenden
    }
  }
  const legacy = getConfig(db, 'br24_feed_url');
  if (legacy && isHttpUrl(legacy)) return { feeds: [resolveFeed(legacy)?.key ?? legacy] };
  return { feeds: [...defaults.rssFeeds] };
}

export { isHttpUrl };

/** Speichert die Feed-Liste; ungültige Einträge werden abgewiesen. */
export function saveSourcesConfig(
  db: Db,
  input: unknown,
  defaults: SourcesDefaults,
): SourcesConfig {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  if ('feeds' in i) setConfig(db, 'rss_feeds', JSON.stringify(normalizeFeedList(i.feeds)));
  return getSourcesConfig(db, defaults);
}

export function articleCounts(db: Db): { total: number; ready: number; failed: number } {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(status = 'ready') AS ready, SUM(status = 'failed') AS failed FROM articles`,
    )
    .get() as { total: number; ready: number | null; failed: number | null };
  return { total: r.total, ready: r.ready ?? 0, failed: r.failed ?? 0 };
}

// --- Interessen lernen (SPEC §5.3) ---------------------------------------------------

/** Gewichte verblassen mit einer Halbwertszeit von 30 Tagen. */
export const HALF_LIFE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Punkte je Signal: geöffnet, bis zum Ende gelesen, schnell wieder verlassen. */
export const POINTS = { opened: 1, reachedEnd: 3, quickExit: -1 } as const;
/** Unter so vielen Sekunden (und nicht bis zum Ende) gilt ein Artikel als „schnell verlassen“. */
export const QUICK_EXIT_SECONDS = 20;
/** Schrittweite für „mehr davon“ / „weniger davon“. */
export const ADJUST_STEP = 3;

const SECTION_LABELS = (de as { sections: Record<string, string> }).sections;

/** Themen-Namen einheitlich schreiben: Leerraum zusammenfassen, erster Buchstabe groß. */
export function normalizeTopic(topic: string): string {
  const t = topic.replace(/\s+/g, ' ').trim().slice(0, 40);
  return t ? t.charAt(0).toLocaleUpperCase('de-DE') + t.slice(1) : '';
}

/** Themen eines Artikels: Rubrik (als lesbares Wort) plus Schlagworte der KI. */
export function articleTopics(a: { section?: string; topics?: string[] }): string[] {
  const out: string[] = [];
  const section = a.section ? (SECTION_LABELS[a.section] ?? a.section) : null;
  for (const t of [section, ...(a.topics ?? [])]) {
    const n = t ? normalizeTopic(t) : '';
    if (n && !out.some((o) => o.toLowerCase() === n.toLowerCase())) out.push(n);
  }
  return out;
}

export function decay(weight: number, updatedAt: string, now: Date): number {
  const days = Math.max(0, now.getTime() - new Date(updatedAt).getTime()) / DAY_MS;
  return weight * 0.5 ** (days / HALF_LIFE_DAYS);
}

export function interests(db: Db, now: Date, device = DEFAULT_DEVICE): Interest[] {
  const rows = db
    .prepare('SELECT topic, weight, updated_at FROM topic_weights WHERE device = ?')
    .all(device) as {
    topic: string;
    weight: number;
    updated_at: string;
  }[];
  return rows
    .map((r) => ({ topic: r.topic, weight: Number(decay(r.weight, r.updated_at, now).toFixed(3)) }))
    .filter((i) => Math.abs(i.weight) >= 0.05)
    .sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic, 'de'));
}

export function addTopicPoints(
  db: Db,
  topics: string[],
  points: number,
  now: Date,
  device = DEFAULT_DEVICE,
): void {
  const iso = now.toISOString();
  const get = db.prepare(
    'SELECT weight, updated_at FROM topic_weights WHERE device = ? AND topic = ?',
  );
  const put = db.prepare(
    `INSERT INTO topic_weights (device, topic, weight, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(device, topic) DO UPDATE SET weight = excluded.weight, updated_at = excluded.updated_at`,
  );
  db.transaction(() => {
    for (const topic of topics) {
      const row = get.get(device, topic) as { weight: number; updated_at: string } | undefined;
      const current = row ? decay(row.weight, row.updated_at, now) : 0;
      put.run(device, topic, current + points, iso);
    }
  })();
}

/** Punkte aus einem Lesesignal; null, wenn das Signal unbrauchbar ist. */
export function signalPoints(input: unknown): { articleId: string; points: number } | null {
  if (!input || typeof input !== 'object') return null;
  const i = input as Partial<ReadingSignal>;
  if (typeof i.articleId !== 'string' || !/^[a-z0-9-]{1,120}$/.test(i.articleId)) return null;
  if (typeof i.seconds !== 'number' || !Number.isFinite(i.seconds) || i.seconds < 0) return null;
  const reachedEnd = i.reachedEnd === true;
  if (!reachedEnd && i.seconds < QUICK_EXIT_SECONDS)
    return { articleId: i.articleId, points: POINTS.quickExit };
  return { articleId: i.articleId, points: POINTS.opened + (reachedEnd ? POINTS.reachedEnd : 0) };
}

/** „Mehr davon“ (+1) / „Weniger davon“ (−1) je Thema und „Alles vergessen“. */
export function adjustInterests(
  db: Db,
  input: unknown,
  now: Date,
  device = DEFAULT_DEVICE,
): Interest[] {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  if (i.forgetAll === true) db.prepare('DELETE FROM topic_weights WHERE device = ?').run(device);
  if (i.adjust && typeof i.adjust === 'object') {
    for (const [rawTopic, dir] of Object.entries(i.adjust as Record<string, unknown>)) {
      const topic = normalizeTopic(rawTopic);
      if (!topic || typeof dir !== 'number' || !Number.isFinite(dir) || dir === 0) continue;
      addTopicPoints(
        db,
        [topic],
        Math.sign(dir) * Math.min(3, Math.abs(Math.round(dir))) * ADJUST_STEP,
        now,
        device,
      );
    }
  }
  return interests(db, now, device);
}

export function forgetInterests(db: Db, device = DEFAULT_DEVICE): void {
  db.prepare('DELETE FROM topic_weights WHERE device = ?').run(device);
}

/**
 * Interessen für die Auswahl, nur mit Einverständnis (SPEC §5.3).
 * Lieblingsthemen sind die bis zu 5 Themen mit dem höchsten positiven Gewicht.
 */
export function interestRanker(
  db: Db,
  settings: Settings,
  now: Date,
  device = DEFAULT_DEVICE,
): InterestRanker | null {
  if (settings.interestLearning !== true) return null;
  const list = interests(db, now, device);
  if (!list.some((i) => i.weight > 0)) return null;
  const weights = new Map(list.map((i) => [i.topic.toLowerCase(), i.weight]));
  const favorites = new Set(
    list
      .filter((i) => i.weight > 0)
      .slice(0, 5)
      .map((i) => i.topic.toLowerCase()),
  );
  const topicsOf = (a: Article): string[] => articleTopics(a).map((t) => t.toLowerCase());
  return {
    score: (a) => topicsOf(a).reduce((sum, t) => sum + (weights.get(t) ?? 0), 0),
    favorite: (a) => topicsOf(a).some((t) => favorites.has(t)),
  };
}
