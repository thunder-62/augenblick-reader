/**
 * Füllt die Datenbank mit selbst geschriebenen Beispielartikeln – für die Entwicklung ohne
 * Internetzugang und für die E2E-Tests. Aufruf: `npm run demo`.
 */
import { loadConfig, loadEnvFile } from './core/config.ts';
import { openDb } from './core/db.ts';
import { runPipeline } from './core/pipeline.ts';
import { DemoAdapter } from './sources/demo.ts';

loadEnvFile();
const config = loadConfig();
const db = openDb(config.dbPath);
const report = await runPipeline(db, [new DemoAdapter()], {
  sections: config.settings.sections,
  maxArticlesPerRun: 50,
  retentionDays: config.retentionDays,
});
db.close();
console.log(`Beispielausgabe in ${config.dbPath}: ${report.edition?.articles ?? 0} Artikel`);
