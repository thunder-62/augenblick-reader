import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { Health } from '@augenblick/shared';
import { registerAdmin } from './admin.ts';
import type { Config } from './core/config.ts';
import { getArticle, latestEdition, sourceStatuses, type Db } from './core/db.ts';
import { getSettings, getSourcesConfig, logUsage, parseUsageEvent } from './core/store.ts';
import { VERSION } from './core/version.ts';

export type AppConfig = Pick<
  Config,
  | 'settings'
  | 'adminPin'
  | 'adminNetworks'
  | 'br24FeedUrl'
  | 'dbPath'
  | 'dataDir'
  | 'anthropicApiKey'
  | 'summaryModel'
  | 'summaryDailyLimit'
>;

export type AppOptions = {
  db: Db;
  config: AppConfig;
  webDist: string | null;
  logger?: boolean;
  now?: () => Date;
};

export function createApp({
  db,
  config,
  webDist,
  logger = false,
  now = () => new Date(),
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger, bodyLimit: 64 * 1024 });

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

  app.get('/api/settings', async () => getSettings(db, config.settings));

  // Nutzungsprotokoll (SPEC §10): nur lokal, abschaltbar.
  app.post('/api/usage', async (req, reply) => {
    if (!getSourcesConfig(db, config).usageLogEnabled) return reply.code(204).send();
    const event = parseUsageEvent(req.body);
    if (!event) return reply.code(400).send({ error: 'invalid' });
    logUsage(db, event, now());
    return reply.code(204).send();
  });

  registerAdmin(app, { db, config, now });

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
    app.get('/admin', (_req, reply) =>
      reply.type('text/html').header('cache-control', 'no-cache').sendFile('admin.html'),
    );
    app.get('/admin/*', (_req, reply) =>
      reply.type('text/html').header('cache-control', 'no-cache').sendFile('admin.html'),
    );
    app.setNotFoundHandler((_req, reply) => reply.type('text/html').sendFile('index.html'));
  }

  return app;
}
