/** Admin-Bereich (SPEC §10): nur aus erlaubten Netzen und mit PIN. */
import { statfsSync, statSync } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AdminStatus, Settings, Theme } from '@augenblick/shared';
import type { AppConfig } from './app.ts';
import {
  createSessionToken,
  isAllowedAddress,
  LoginThrottle,
  parseNetworks,
  pinMatches,
  readCookie,
  SESSION_COOKIE,
  sessionCookie,
  sessionSecret,
  verifySessionToken,
} from './core/auth.ts';
import { latestEdition, sourceStatuses, type Db } from './core/db.ts';
import {
  articleCounts,
  deleteUsage,
  getConfig,
  getSettings,
  getSourcesConfig,
  saveSettings,
  saveSourcesConfig,
  setConfig,
  usageByDay,
} from './core/store.ts';
import { VERSION } from './core/version.ts';

type Deps = { db: Db; config: AppConfig; now: () => Date };

function fileSize(file: string): number {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
}

function freeBytes(dir: string): number | null {
  try {
    const s = statfsSync(dir);
    return s.bavail * s.bsize;
  } catch {
    return null;
  }
}

export function registerAdmin(app: FastifyInstance, { db, config, now }: Deps): void {
  const networks = parseNetworks(config.adminNetworks);
  const throttle = new LoginThrottle();
  const secret = sessionSecret(db);

  const allowedNetwork = (req: FastifyRequest): boolean =>
    isAllowedAddress(networks, req.socket.remoteAddress);
  const loggedIn = (req: FastifyRequest): boolean =>
    verifySessionToken(secret, readCookie(req.headers.cookie, SESSION_COOKIE), now().getTime());

  // Netzprüfung für Seite und API des Admin-Bereichs.
  app.addHook('onRequest', async (req, reply) => {
    const url = req.url.split('?')[0] ?? '';
    const isAdmin =
      url === '/admin' ||
      url.startsWith('/admin/') ||
      url === '/admin.html' ||
      url.startsWith('/api/admin/');
    if (!isAdmin) return;
    if (!allowedNetwork(req)) {
      return reply
        .code(403)
        .type('text/plain; charset=utf-8')
        .send('Der Admin-Bereich ist nur über Tailscale erreichbar.');
    }
    if (url.startsWith('/api/admin/') && !config.adminPin)
      return reply.code(503).send({ error: 'no_pin' });
  });

  const guard = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!loggedIn(req)) await reply.code(401).send({ error: 'login' });
  };

  app.post<{ Body: { pin?: unknown } }>('/api/admin/login', async (req, reply) => {
    if (throttle.locked()) return reply.code(429).send({ error: 'locked' });
    if (!config.adminPin || !pinMatches(config.adminPin, req.body?.pin)) {
      throttle.fail();
      return reply.code(401).send({ error: 'pin' });
    }
    throttle.success();
    reply.header(
      'set-cookie',
      sessionCookie(createSessionToken(secret, now().getTime()), req.protocol === 'https'),
    );
    return { ok: true };
  });

  app.post('/api/admin/logout', async (req, reply) => {
    reply.header('set-cookie', sessionCookie('', req.protocol === 'https', 0));
    return { ok: true };
  });

  app.get('/api/admin/session', { preHandler: guard }, async () => ({ ok: true }));

  app.get('/api/admin/status', { preHandler: guard }, async (): Promise<AdminStatus> => {
    const edition = latestEdition(db);
    const memory = config.dbPath === ':memory:';
    return {
      version: VERSION,
      now: now().toISOString(),
      edition: {
        day: edition.day,
        updatedAt: edition.updatedAt,
        articles: edition.articles.length,
      },
      sources: sourceStatuses(db),
      articles: articleCounts(db),
      storage: {
        dbBytes: memory ? 0 : fileSize(config.dbPath) + fileSize(`${config.dbPath}-wal`),
        freeBytes: memory ? null : freeBytes(config.dataDir),
      },
      calibratedAt: getConfig(db, 'calibrated_at'),
    };
  });

  app.get('/api/admin/settings', { preHandler: guard }, async () => ({
    settings: getSettings(db, config.settings),
    defaults: config.settings,
  }));

  app.put('/api/admin/settings', { preHandler: guard }, async (req): Promise<Settings> =>
    saveSettings(db, req.body, config.settings, now().toISOString()),
  );

  // Ergebnis der Kalibrierung (SPEC §8.4): Schriftgröße und Farbschema.
  app.post<{ Body: { fontSizePx?: unknown; theme?: unknown } }>(
    '/api/admin/calibration',
    { preHandler: guard },
    async (req, reply) => {
      const { fontSizePx, theme } = req.body ?? {};
      if (typeof fontSizePx !== 'number' || (theme !== 'light' && theme !== 'dark')) {
        return reply.code(400).send({ error: 'invalid' });
      }
      const at = now().toISOString();
      const settings = saveSettings(db, { fontSizePx, theme: theme as Theme }, config.settings, at);
      setConfig(db, 'calibrated_at', at);
      return settings;
    },
  );

  app.get('/api/admin/sources', { preHandler: guard }, async () => getSourcesConfig(db, config));

  app.put('/api/admin/sources', { preHandler: guard }, async (req, reply) => {
    try {
      return saveSourcesConfig(db, req.body, config);
    } catch (err) {
      return reply
        .code(400)
        .send({ error: 'invalid', message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/admin/usage', { preHandler: guard }, async () => ({
    enabled: getSourcesConfig(db, config).usageLogEnabled,
    days: usageByDay(db, 14),
  }));

  app.delete('/api/admin/usage', { preHandler: guard }, async () => ({ deleted: deleteUsage(db) }));
}
