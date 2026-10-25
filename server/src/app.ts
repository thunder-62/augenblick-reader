import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { Health, SettingsSource } from '@augenblick/shared';
import type { Config } from './core/config.ts';
import { getArticle, latestEdition, sourceStatuses, type Db } from './core/db.ts';
import {
  addTopicPoints,
  adjustInterests,
  articleTopics,
  baselineSettings,
  forgetInterests,
  getIntro,
  getSettings,
  interests,
  parseIntro,
  pick,
  saveSettings,
  setIntro,
  signalPoints,
  USER_KEYS,
} from './core/store.ts';
import { hostChecker } from './core/hosts.ts';
import { serverT } from './core/i18n.ts';
import { MEDIA_NAME, MEDIA_TYPES, mediaDir } from './core/media.ts';
import { VERSION } from './core/version.ts';
import { registerTechnik } from './technik.ts';

export type AppConfig = Pick<
  Config,
  | 'settings'
  | 'technikNetworks'
  | 'allowedHosts'
  | 'rssFeeds'
  | 'dbPath'
  | 'dataDir'
  | 'openrouterApiKey'
  | 'openrouterModel'
  | 'openrouterFallbackModel'
  | 'summaryDailyLimit'
>;

export type AppOptions = {
  db: Db;
  config: AppConfig;
  webDist: string | null;
  logger?: boolean;
  now?: () => Date;
};

/** Woher die Nutzerin auf dem Tablet speichert (SPEC §8.7, §8.8). */
const USER_SOURCES: SettingsSource[] = ['nutzerin', 'einfuehrung', 'kalibrierung', 'wie-am-anfang'];

export function createApp({
  db,
  config,
  webDist,
  logger = false,
  now = () => new Date(),
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger, bodyLimit: 64 * 1024 });

  // Schutz gegen DNS-Rebinding und CSRF (ADR 013): nur bekannte Host-Namen, Änderungen nur als JSON.
  const hostAllowed = hostChecker(config.allowedHosts);
  app.addHook('onRequest', async (req, reply) => {
    if (!hostAllowed(req.headers.host))
      return reply.code(421).type('text/plain; charset=utf-8').send(serverT('errors.host'));
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const type = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
      if (type !== 'application/json') return reply.code(415).send({ error: 'content_type' });
    }
  });

  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith('/api/') || req.url === '/health')
      reply.header('cache-control', 'no-store');
  });

  app.get('/health', async (): Promise<Health> => {
    const edition = latestEdition(db);
    return {
      status: 'ok',
      version: VERSION,
      edition: {
        day: edition.day,
        updatedAt: edition.updatedAt,
        articles: edition.articles.length,
      },
      sources: sourceStatuses(db),
    };
  });

  app.get('/api/edition', async () => latestEdition(db));

  app.get<{ Params: { id: string } }>('/api/articles/:id', async (req, reply) => {
    const article = getArticle(db, req.params.id);
    if (!article || article.status !== 'ready') return reply.code(404).send({ error: 'not_found' });
    return article;
  });

  // --- Einstellungen der Nutzerin (SPEC §8.7): kein PIN; das Tablet speichert erst nach Rückfrage.
  app.get('/api/settings', async () => getSettings(db, config.settings));

  app.get('/api/settings/baseline', async () => baselineSettings(db, config.settings));

  app.put<{ Body: { settings?: unknown; source?: unknown } }>(
    '/api/settings',
    async (req, reply) => {
      const source = req.body?.source as SettingsSource;
      if (!USER_SOURCES.includes(source)) return reply.code(400).send({ error: 'source' });
      const patch = pick(req.body?.settings, USER_KEYS);
      const saved = saveSettings(db, patch, config.settings, now().toISOString(), source);
      // Ohne Einverständnis wird nichts gelernt und nichts aufbewahrt (SPEC §5.3).
      if (saved.interestLearning === false) forgetInterests(db);
      return saved;
    },
  );

  // --- Einführung (SPEC §8.8): Fortschritt, damit sie später an derselben Stelle weitergeht.
  app.get('/api/intro', async () => getIntro(db));

  app.put('/api/intro', async (req, reply) => {
    const intro = parseIntro(req.body);
    if (!intro) return reply.code(400).send({ error: 'invalid' });
    setIntro(db, intro);
    return intro;
  });

  // --- Interessen (SPEC §5.3): nur mit Einverständnis; gespeichert werden nur Themen-Gewichte.
  const learning = (): boolean => getSettings(db, config.settings).interestLearning === true;

  app.get('/api/interests', async () => (learning() ? interests(db, now()) : []));

  app.put('/api/interests', async (req) =>
    learning() ? adjustInterests(db, req.body, now()) : [],
  );

  app.post('/api/reading', async (req, reply) => {
    const signal = signalPoints(req.body);
    if (!signal) return reply.code(400).send({ error: 'invalid' });
    const article = learning() ? getArticle(db, signal.articleId) : null;
    if (article) addTopicPoints(db, articleTopics(article), signal.points, now());
    return reply.code(204).send();
  });

  // Bilder der Artikel, vom Pi selbst ausgeliefert (ADR 021). Nur Dateinamen aus Prüfsumme und
  // Endung – kein Pfad, keine fremde Adresse.
  app.get<{ Params: { name: string } }>('/media/:name', async (req, reply) => {
    const name = req.params.name;
    if (!MEDIA_NAME.test(name)) return reply.code(404).send({ error: 'not_found' });
    const file = path.join(mediaDir(config.dataDir), name);
    if (!existsSync(file)) return reply.code(404).send({ error: 'not_found' });
    return reply
      .type(MEDIA_TYPES[name.split('.').pop() ?? ''] ?? 'application/octet-stream')
      .header('cache-control', 'public, max-age=31536000, immutable')
      .send(createReadStream(file));
  });

  registerTechnik(app, { db, config, now });

  app.all('/api/*', async (_req, reply) => reply.code(404).send({ error: 'not_found' }));

  if (webDist) {
    void app.register(fastifyStatic, {
      root: path.resolve(webDist),
      setHeaders: (reply, file) => {
        // Gebaute Dateien mit Hash im Namen dürfen lange im Cache liegen, HTML nie.
        reply.header(
          'cache-control',
          file.includes(`${path.sep}assets${path.sep}`)
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        );
      },
    });
    const technikPage = (_req: unknown, reply: import('fastify').FastifyReply) =>
      reply.type('text/html').header('cache-control', 'no-cache').sendFile('technik.html');
    app.get('/technik', technikPage);
    app.get('/technik/*', technikPage);
    app.setNotFoundHandler((_req, reply) => reply.type('text/html').sendFile('index.html'));
  }

  return app;
}
