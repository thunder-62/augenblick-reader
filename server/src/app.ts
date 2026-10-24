import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { Health, Settings } from '@augenblick/shared';
import { getArticle, latestEdition, sourceStatuses, type Db } from './core/db.ts';
import { VERSION } from './core/version.ts';

export type AppOptions = {
  db: Db;
  settings: Settings;
  webDist: string | null;
  logger?: boolean;
};

export function createApp({ db, settings, webDist, logger = false }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

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

  app.get('/api/settings', async () => settings);

  app.all('/api/*', async (_req, reply) => reply.code(404).send({ error: 'not_found' }));

  if (webDist) {
    void app.register(fastifyStatic, {
      root: path.resolve(webDist),
      setHeaders: (reply, file) => {
        // Gebaute Dateien mit Hash im Namen dürfen lange im Cache liegen, index.html nie.
        reply.header(
          'cache-control',
          file.includes(`${path.sep}assets${path.sep}`)
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        );
      },
    });
    app.setNotFoundHandler((_req, reply) => reply.type('text/html').sendFile('index.html'));
  }

  return app;
}
