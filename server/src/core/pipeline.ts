/** Verarbeitungs-Pipeline (SPEC §5.2), vorerst ohne KI. */
import type { Article, SectionQuota } from '@augenblick/shared';
import type { SourceAdapter } from '../sources/types.ts';
import { buildArticle, makeArticleId } from './article.ts';
import { htmlToBlocks } from './clean.ts';
import {
  aiUsage,
  cleanup,
  getArticle,
  latestEdition,
  recordAiUsage,
  saveSummary,
  summaryAttempts,
  getEditionIds,
  hasArticle,
  readyArticlesSince,
  recordSourceAttempt,
  saveEdition,
  upsertArticle,
  type Db,
} from './db.ts';
import { log } from './log.ts';
import { selectEdition } from './selection.ts';
import { articleText, createSummary, type SummaryProvider } from './summary.ts';
import { berlinDay } from './time.ts';

export type PipelineOptions = {
  sections: SectionQuota[];
  maxArticlesPerRun: number;
  retentionDays: number;
  now?: () => Date;
};

export type SourceReport = {
  source: string;
  listed: number;
  added: number;
  failed: number;
  error?: string;
};
export type RunReport = {
  sources: SourceReport[];
  edition: { day: string; articles: number } | null;
};

async function processSource(
  db: Db,
  adapter: SourceAdapter,
  opts: PipelineOptions,
): Promise<SourceReport> {
  const now = (opts.now ?? (() => new Date()))().toISOString();
  const report: SourceReport = { source: adapter.id, listed: 0, added: 0, failed: 0 };
  let items;
  try {
    items = await adapter.fetchList();
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err);
    recordSourceAttempt(db, adapter.id, now, report.error);
    log.error(`[${adapter.id}] Liste nicht abrufbar`, err);
    return report;
  }
  report.listed = items.length;
  const fresh = items
    .filter((it) => !hasArticle(db, makeArticleId(adapter.id, it.id)))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, opts.maxArticlesPerRun);
  for (const item of fresh) {
    try {
      const raw = await adapter.fetchArticle(item);
      const blocks = htmlToBlocks(raw.html);
      const article = buildArticle(adapter.id, { ...raw, blocks }, now);
      upsertArticle(db, article);
      if (article.status === 'ready') report.added++;
      else report.failed++;
    } catch (err) {
      // Ein kaputter Artikel blockiert nichts; er wird beim nächsten Lauf erneut versucht.
      report.failed++;
      log.warn(
        `[${adapter.id}] Artikel übersprungen: ${item.url} – ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  recordSourceAttempt(db, adapter.id, now, null);
  return report;
}

/** Stellt die Ausgabe des Tages zusammen; ohne neue Artikel bleibt die letzte Ausgabe stehen. */
export function buildEdition(
  db: Db,
  now: Date,
  sections: SectionQuota[],
): { day: string; articles: number } | null {
  const day = berlinDay(now);
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const candidates = readyArticlesSince(db, since);
  const existing = (getEditionIds(db, day) ?? [])
    .map((id) => getArticle(db, id))
    .filter((a): a is Article => a !== null && a.status === 'ready');
  const ids = selectEdition(candidates, existing, sections);
  if (!ids.length) return null;
  const before = getEditionIds(db, day);
  if (!before || before.join() !== ids.join()) saveEdition(db, day, ids, now.toISOString());
  return { day, articles: ids.length };
}

export async function runPipeline(
  db: Db,
  adapters: SourceAdapter[],
  opts: PipelineOptions,
): Promise<RunReport> {
  const results = await Promise.allSettled(adapters.map((a) => processSource(db, a, opts)));
  const sources = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: adapters[i]?.id ?? '?', listed: 0, added: 0, failed: 0, error: String(r.reason) },
  );
  const now = (opts.now ?? (() => new Date()))();
  const edition = buildEdition(db, now, opts.sections);
  const removed = cleanup(db, now, opts.retentionDays);
  log.info('Lauf beendet', { sources, edition, removed });
  return { sources, edition };
}

/** Höchstens so viele KI-Versuche je Artikel (Fehlschläge eingeschlossen), dann bleibt der Fallback. */
export const MAX_SUMMARY_ATTEMPTS = 2;

export type SummaryOptions = { provider: SummaryProvider; dailyLimit: number; now?: () => Date };
export type SummaryReport = { created: number; failed: number; skipped: number; calls: number };

/**
 * KI-Kurzfassungen für die Artikel der aktuellen Ausgabe (SPEC §6): nur was gezeigt wird,
 * einmal pro Artikel, innerhalb des Tageslimits. Was nicht klappt, behält den Fallback.
 */
export async function summarizeEdition(db: Db, opts: SummaryOptions): Promise<SummaryReport> {
  const now = (opts.now ?? (() => new Date()))();
  const day = berlinDay(now);
  const report: SummaryReport = { created: 0, failed: 0, skipped: 0, calls: 0 };
  const edition = latestEdition(db);
  for (const card of edition.articles) {
    if (card.summaryAi) continue;
    if (summaryAttempts(db, card.id) >= MAX_SUMMARY_ATTEMPTS) {
      report.skipped++;
      continue;
    }
    const article = getArticle(db, card.id);
    if (!article) continue;
    // Jeder Aufruf (auch der Neuversuch) zählt gegen das Tageslimit.
    let budget = opts.dailyLimit - aiUsage(db, day).calls;
    if (budget <= 0) {
      log.warn(
        `KI-Tageslimit (${opts.dailyLimit} Aufrufe) erreicht – restliche Karten behalten die ersten Sätze.`,
      );
      break;
    }
    const mayCall = (): boolean => (budget > 0 ? (budget--, true) : false);
    const outcome = await createSummary(
      opts.provider,
      { title: article.title, text: articleText(article.blocks), lang: article.lang },
      mayCall,
    );
    report.calls += outcome.calls;
    recordAiUsage(db, day, {
      calls: outcome.calls,
      failures: outcome.ok ? 0 : 1,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
    });
    if (!outcome.ok && outcome.unavailable) {
      // Liegt nicht am Artikel: kein Versuch zählt, Abbruch bis zum nächsten Lauf.
      log.error(`[KI] Kurzfassungen pausiert bis zum nächsten Lauf: ${outcome.reason}`);
      report.failed++;
      break;
    }
    if (outcome.ok) {
      saveSummary(db, article.id, {
        text: outcome.text,
        model: outcome.model,
        createdAt: now.toISOString(),
      });
      report.created++;
    } else {
      saveSummary(db, article.id, null);
      report.failed++;
      log.warn(`[KI] Kurzfassung für ${article.id} nicht übernommen: ${outcome.reason}`);
    }
  }
  return report;
}
