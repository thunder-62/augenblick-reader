import { createApp } from './app.ts';
import { loadConfig, loadEnvFile } from './core/config.ts';
import { openDb } from './core/db.ts';
import { log } from './core/log.ts';
import { VERSION } from './core/version.ts';

loadEnvFile();
const config = loadConfig();
const db = openDb(config.dbPath);
const app = createApp({ db, settings: config.settings, webDist: config.webDist });

if (!config.webDist)
  log.warn(
    'Keine gebaute Web-App gefunden – es läuft nur die API (in der Entwicklung liefert Vite die Oberfläche).',
  );

const shutdown = async (): Promise<void> => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ host: config.host, port: config.port });
log.info(`Augenblick API ${VERSION} läuft auf http://${config.host}:${config.port}`);
