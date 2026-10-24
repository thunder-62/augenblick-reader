/**
 * Worker: holt Artikel nach Zeitplan ab (SPEC §5.2, Schritt 1):
 * alle 30 Minuten zwischen 5:00 und 22:00 (Berliner Zeit), danach Ruhe.
 * `--once`: genau ein Lauf, dann Ende.
 */
import cron from 'node-cron';
import { loadConfig, loadEnvFile } from './core/config.ts';
import { openDb } from './core/db.ts';
import { log } from './core/log.ts';
import { runPipeline } from './core/pipeline.ts';
import { FETCH_SCHEDULES } from './core/schedule.ts';
import { TIME_ZONE } from './core/time.ts';
import { VERSION } from './core/version.ts';
import { createAdapters } from './sources/index.ts';

loadEnvFile();
const config = loadConfig();
const db = openDb(config.dbPath);
const adapters = createAdapters(config);
let running = false;

async function run(): Promise<void> {
  if (running) {
    log.warn('Vorheriger Lauf ist noch nicht fertig – dieser Termin entfällt.');
    return;
  }
  running = true;
  try {
    await runPipeline(db, adapters, {
      sections: config.settings.sections,
      maxArticlesPerRun: config.maxArticlesPerRun,
      retentionDays: config.retentionDays,
    });
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
