import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type {
  AiUsage,
  Article,
  ArticleCard,
  Edition,
  Summary,
  SourceStatus,
} from '@augenblick/shared';
import { isAiSummary } from './article.ts';

export type Db = Database.Database;

/** Migrationen in Reihenfolge; Index + 1 = user_version. Nie bestehende Einträge ändern. */
const MIGRATIONS: string[] = [
  `CREATE TABLE articles (
     id TEXT PRIMARY KEY,
     source TEXT NOT NULL,
     source_url TEXT NOT NULL,
     lang TEXT NOT NULL,
     section TEXT,
     title TEXT NOT NULL,
     published_at TEXT NOT NULL,
     fetched_at TEXT NOT NULL,
     blocks_json TEXT NOT NULL,
     summary_json TEXT,
     word_count INTEGER NOT NULL,
     reading_minutes INTEGER NOT NULL,
     status TEXT NOT NULL
   );
   CREATE INDEX articles_published ON articles(published_at);
   CREATE TABLE editions (
     day TEXT PRIMARY KEY,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     article_ids_json TEXT NOT NULL
   );
   CREATE TABLE source_status (
     source TEXT PRIMARY KEY,
     last_attempt_at TEXT,
     last_success_at TEXT,
     last_error TEXT
   );`,
  // M2: Einstellungen (pro Gerät vorbereitet, SPEC §12a), Konfiguration, Nutzungsprotokoll
  `CREATE TABLE settings (
     device TEXT PRIMARY KEY,
     json TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE config (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );
   CREATE TABLE usage_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     at TEXT NOT NULL,
     day TEXT NOT NULL,
     article_id TEXT NOT NULL,
     pages_seen INTEGER NOT NULL,
     pages_total INTEGER NOT NULL,
     seconds INTEGER NOT NULL
   );
   CREATE INDEX usage_log_day ON usage_log(day);`,
  // M3: KI-Kurzfassungen – Versuche je Artikel und Verbrauch je Tag
  `ALTER TABLE articles ADD COLUMN summary_attempts INTEGER NOT NULL DEFAULT 0;
   CREATE TABLE ai_usage (
     day TEXT PRIMARY KEY,
     calls INTEGER NOT NULL DEFAULT 0,
     failures INTEGER NOT NULL DEFAULT 0,
     input_tokens INTEGER NOT NULL DEFAULT 0,
     output_tokens INTEGER NOT NULL DEFAULT 0
   );`,
  // Neue Spec: Einstellungen gehören der Nutzerin (Verlauf statt PIN), Interessen lernen statt
  // Nutzungsprotokoll, Themen-Schlagworte je Artikel, KI-Kosten über OpenRouter.
  `DROP TABLE usage_log;
   CREATE TABLE settings_history (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     device TEXT NOT NULL,
     saved_at TEXT NOT NULL,
     source TEXT NOT NULL,
     json TEXT NOT NULL
   );
   CREATE INDEX settings_history_device ON settings_history(device, id);
   CREATE TABLE topic_weights (
     device TEXT NOT NULL,
     topic TEXT NOT NULL,
     weight REAL NOT NULL,
     updated_at TEXT NOT NULL,
     PRIMARY KEY (device, topic)
   );
   ALTER TABLE articles ADD COLUMN topics_json TEXT;
   ALTER TABLE ai_usage ADD COLUMN cost_usd REAL NOT NULL DEFAULT 0;`,
];

export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    const sql = MIGRATIONS[v] ?? '';
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${v + 1}`);
    }).immediate();
  }
}

type ArticleRow = {
  id: string;
  source: string;
  source_url: string;
  lang: string;
  section: string | null;
  title: string;
  published_at: string;
  fetched_at: string;
  blocks_json: string;
  summary_json: string | null;
  word_count: number;
  reading_minutes: number;
  status: Article['status'];
  topics_json: string | null;
};

function rowToArticle(r: ArticleRow): Article {
  return {
    id: r.id,
    source: r.source,
    sourceUrl: r.source_url,
    lang: r.lang,
    ...(r.section ? { section: r.section } : {}),
    title: r.title,
    publishedAt: r.published_at,
    fetchedAt: r.fetched_at,
    blocks: JSON.parse(r.blocks_json) as Article['blocks'],
    ...(r.summary_json ? { summary: JSON.parse(r.summary_json) as Article['summary'] } : {}),
    wordCount: r.word_count,
    readingMinutes: r.reading_minutes,
    status: r.status,
    ...(r.topics_json ? { topics: JSON.parse(r.topics_json) as string[] } : {}),
  };
}

export function toCard(a: Article): ArticleCard {
  return {
    id: a.id,
    source: a.source,
    ...(a.section ? { section: a.section } : {}),
    lang: a.lang,
    title: a.title,
    ...(a.summary ? { summary: a.summary.text, summaryAi: isAiSummary(a.summary) } : {}),
    readingMinutes: a.readingMinutes,
    publishedAt: a.publishedAt,
  };
}

export function upsertArticle(db: Db, a: Article): void {
  db.prepare(
    `INSERT INTO articles (id, source, source_url, lang, section, title, published_at, fetched_at,
       blocks_json, summary_json, word_count, reading_minutes, status, topics_json)
     VALUES (@id, @source, @sourceUrl, @lang, @section, @title, @publishedAt, @fetchedAt,
       @blocks, @summary, @wordCount, @readingMinutes, @status, @topics)
     ON CONFLICT(id) DO UPDATE SET
       source_url = excluded.source_url, lang = excluded.lang, section = excluded.section,
       title = excluded.title, published_at = excluded.published_at, fetched_at = excluded.fetched_at,
       blocks_json = excluded.blocks_json, summary_json = excluded.summary_json,
       word_count = excluded.word_count, reading_minutes = excluded.reading_minutes,
       status = excluded.status, topics_json = excluded.topics_json`,
  ).run({
    id: a.id,
    source: a.source,
    sourceUrl: a.sourceUrl,
    lang: a.lang,
    section: a.section ?? null,
    title: a.title,
    publishedAt: a.publishedAt,
    fetchedAt: a.fetchedAt,
    blocks: JSON.stringify(a.blocks),
    summary: a.summary ? JSON.stringify(a.summary) : null,
    wordCount: a.wordCount,
    readingMinutes: a.readingMinutes,
    status: a.status,
    topics: a.topics ? JSON.stringify(a.topics) : null,
  });
}

export function getArticle(db: Db, id: string): Article | null {
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as ArticleRow | undefined;
  return row ? rowToArticle(row) : null;
}

export function hasArticle(db: Db, id: string): boolean {
  return db.prepare('SELECT 1 FROM articles WHERE id = ?').get(id) !== undefined;
}

/** Fertige Artikel, die seit `sinceIso` erschienen sind, neueste zuerst. */
export function readyArticlesSince(db: Db, sinceIso: string): Article[] {
  const rows = db
    .prepare(
      `SELECT * FROM articles WHERE status = 'ready' AND published_at >= ? ORDER BY published_at DESC`,
    )
    .all(sinceIso) as ArticleRow[];
  return rows.map(rowToArticle);
}

export function getEditionIds(db: Db, day: string): string[] | null {
  const row = db.prepare('SELECT article_ids_json FROM editions WHERE day = ?').get(day) as
    { article_ids_json: string } | undefined;
  return row ? (JSON.parse(row.article_ids_json) as string[]) : null;
}

export function saveEdition(db: Db, day: string, ids: string[], now: string): void {
  db.prepare(
    `INSERT INTO editions (day, created_at, updated_at, article_ids_json) VALUES (?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET updated_at = excluded.updated_at, article_ids_json = excluded.article_ids_json`,
  ).run(day, now, now, JSON.stringify(ids));
}

/** Die neueste Ausgabe; Artikel, die es nicht mehr gibt, fallen heraus. */
export function latestEdition(db: Db): Edition {
  const row = db.prepare('SELECT * FROM editions ORDER BY day DESC LIMIT 1').get() as
    { day: string; updated_at: string; article_ids_json: string } | undefined;
  if (!row) return { day: null, updatedAt: null, articles: [] };
  const ids = JSON.parse(row.article_ids_json) as string[];
  const articles = ids
    .map((id) => getArticle(db, id))
    .filter((a): a is Article => a !== null && a.status === 'ready')
    .map(toCard);
  return { day: row.day, updatedAt: row.updated_at, articles };
}

export function recordSourceAttempt(
  db: Db,
  source: string,
  now: string,
  error: string | null,
): void {
  db.prepare(
    `INSERT INTO source_status (source, last_attempt_at, last_success_at, last_error) VALUES (@source, @now, @success, @error)
     ON CONFLICT(source) DO UPDATE SET last_attempt_at = @now,
       last_success_at = COALESCE(@success, source_status.last_success_at), last_error = @error`,
  ).run({ source, now, success: error ? null : now, error });
}

export function sourceStatuses(db: Db): SourceStatus[] {
  const rows = db.prepare('SELECT * FROM source_status ORDER BY source').all() as {
    source: string;
    last_attempt_at: string | null;
    last_success_at: string | null;
    last_error: string | null;
  }[];
  return rows.map((r) => ({
    source: r.source,
    lastAttemptAt: r.last_attempt_at,
    lastSuccessAt: r.last_success_at,
    lastError: r.last_error,
  }));
}

/**
 * Aufräumen (SPEC §5.2, Schritt 6): Artikel älter als `days` Tage löschen, ebenso alte Ausgaben.
 * Artikel der neuesten Ausgabe bleiben immer erhalten, damit die letzte Ausgabe sichtbar bleibt.
 */
export function cleanup(db: Db, now: Date, days: number): { articles: number; editions: number } {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();
  const cutoffDay = cutoffIso.slice(0, 10);
  return db.transaction(() => {
    const latest = db
      .prepare('SELECT day, article_ids_json FROM editions ORDER BY day DESC LIMIT 1')
      .get() as { day: string; article_ids_json: string } | undefined;
    const keep = new Set<string>(latest ? (JSON.parse(latest.article_ids_json) as string[]) : []);
    const old = db
      .prepare('SELECT id FROM articles WHERE published_at < ? AND fetched_at < ?')
      .all(cutoffIso, cutoffIso) as { id: string }[];
    const del = db.prepare('DELETE FROM articles WHERE id = ?');
    let articles = 0;
    for (const { id } of old) {
      if (keep.has(id)) continue;
      articles += del.run(id).changes;
    }
    const editions = db
      .prepare("DELETE FROM editions WHERE day < ? AND day <> COALESCE(?, '')")
      .run(cutoffDay, latest?.day ?? null).changes;
    return { articles, editions };
  })();
}

export function summaryAttempts(db: Db, id: string): number {
  const row = db.prepare('SELECT summary_attempts AS n FROM articles WHERE id = ?').get(id) as
    { n: number } | undefined;
  return row?.n ?? 0;
}

/** Speichert KI-Kurzfassung und Themen bzw. zählt einen fehlgeschlagenen Versuch. */
export function saveSummary(db: Db, id: string, summary: Summary | null, topics?: string[]): void {
  if (summary) {
    db.prepare(
      `UPDATE articles SET summary_json = ?, topics_json = COALESCE(?, topics_json),
         summary_attempts = summary_attempts + 1 WHERE id = ?`,
    ).run(JSON.stringify(summary), topics ? JSON.stringify(topics) : null, id);
  } else {
    db.prepare('UPDATE articles SET summary_attempts = summary_attempts + 1 WHERE id = ?').run(id);
  }
}

export function recordAiUsage(
  db: Db,
  day: string,
  u: {
    calls: number;
    failures: number;
    inputTokens: number;
    outputTokens: number;
    costUsd?: number;
  },
): void {
  db.prepare(
    `INSERT INTO ai_usage (day, calls, failures, input_tokens, output_tokens, cost_usd)
     VALUES (@day, @calls, @failures, @input, @output, @cost)
     ON CONFLICT(day) DO UPDATE SET calls = calls + @calls, failures = failures + @failures,
       input_tokens = input_tokens + @input, output_tokens = output_tokens + @output,
       cost_usd = cost_usd + @cost`,
  ).run({
    day,
    calls: u.calls,
    failures: u.failures,
    input: u.inputTokens,
    output: u.outputTokens,
    cost: u.costUsd ?? 0,
  });
}

export function aiUsage(db: Db, day: string): AiUsage {
  const row = db.prepare('SELECT * FROM ai_usage WHERE day = ?').get(day) as
    | {
        calls: number;
        failures: number;
        input_tokens: number;
        output_tokens: number;
        cost_usd: number;
      }
    | undefined;
  return {
    day,
    calls: row?.calls ?? 0,
    failures: row?.failures ?? 0,
    inputTokens: row?.input_tokens ?? 0,
    outputTokens: row?.output_tokens ?? 0,
    costUsd: row?.cost_usd ?? 0,
  };
}
