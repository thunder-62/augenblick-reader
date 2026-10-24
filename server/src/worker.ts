/**
 * Worker: holt Artikel nach Zeitplan ab (SPEC §5.2, Schritt 1):
 * alle 30 Minuten zwischen 5:00 und 22:00 (Berliner Zeit), danach Ruhe.
 * `--once`: genau ein Lauf, dann Ende.
 */
import cron from 'node-cron';
import { loadConfig, loadEnvFile } from './core/config.ts';
import { openDb } from './core/db.ts';
import { log } from './core/log.ts';
import { OpenRouterSummaryProvider } from './core/openrouter.ts';
import { runPipeline, summarizeCandidates, summarizeEdition } from './core/pipeline.ts';
import { loadPrompt } from './core/summary.ts';
import { FETCH_SCHEDULES } from './core/schedule.ts';
import { getSettings, getSourcesConfig, interestRanker } from './core/store.ts';
import { TIME_ZONE } from './core/time.ts';
import { VERSION } from './core/version.ts';
import { createAdapters } from './sources/index.ts';

loadEnvFile();
const config = loadConfig();
const db = openDb(config.dbPath);
// Feed-Liste und Rubriken-Mix können im Technik-Bereich geändert werden und gelten ab dem nächsten Lauf.
const adapters = createAdapters(config, () => getSourcesConfig(db, config).feeds);
// KI-Kurzfassungen nur mit OpenRouter-Schlüssel; sonst Anreißer bzw. erste Sätze (SPEC §6).
const summaryProvider = config.openrouterApiKey
  ? new OpenRouterSummaryProvider({
      apiKey: config.openrouterApiKey,
      model: config.openrouterModel,
      fallbackModel: config.openrouterFallbackModel,
      prompt: loadPrompt(config.promptsDir, 'de'),
    })
  : null;
if (!summaryProvider) {
  log.warn(
    'Kein OPENROUTER_API_KEY – Kurzfassungen sind die Anreißer bzw. ersten Sätze der Artikel.',
  );
}
let running = false;

async function run(): Promise<void> {
  if (running) {
    log.warn('Vorheriger Lauf ist noch nicht fertig – dieser Termin entfällt.');
    return;
  }
  running = true;
  try {
    const settings = getSettings(db, config.settings);
    const summaryOpts = summaryProvider
      ? { provider: summaryProvider, dailyLimit: config.summaryDailyLimit }
      : null;
    await runPipeline(db, adapters, {
      sections: settings.sections,
      ranker: interestRanker(db, settings, new Date()),
      maxArticlesPerRun: config.maxArticlesPerRun,
      retentionDays: config.retentionDays,
      // Erst Kurzfassungen und Schlagworte der Kandidaten, dann die Auswahl (Auftrag 004, C8).
      ...(summaryOpts && {
        beforeEdition: async () =>
          log.info('Kurzfassungen (Kandidaten)', await summarizeCandidates(db, summaryOpts)),
      }),
    });
    // Was dann neu in der Ausgabe steht und noch keine KI-Kurzfassung hat.
    if (summaryOpts) log.info('Kurzfassungen (Ausgabe)', await summarizeEdition(db, summaryOpts));
  } catch (err) {
    log.error('Lauf fehlgeschlagen', err);
  } finally {
    running = false;
  }
}

if (process.argv.includes('--once')) {
  await run();
  db.close();
} else {
  log.info(
    `Augenblick Worker ${VERSION} gestartet; Zeitplan: ${FETCH_SCHEDULES.join(' | ')} (${TIME_ZONE})`,
  );
  for (const expr of FETCH_SCHEDULES)
    cron.schedule(expr, () => void run(), { timezone: TIME_ZONE, noOverlap: true });
  if (config.fetchOnStart) void run();
  const stop = (): void => {
    db.close();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
