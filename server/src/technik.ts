/**
 * Technik-Bereich für den Betreuer (SPEC §10): ohne PIN, nur aus dem Heimnetz bzw. über Tailscale.
 * Enthält Technik, keine Bevormundung – Leseeinstellungen nur ansehen und auf frühere Fassungen zurücksetzen.
 */
import { statfsSync, statSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { TechnikStatus } from '@augenblick/shared';
import type { AppConfig } from './app.ts';
import { aiUsage, latestEdition, sourceStatuses, type Db } from './core/db.ts';
import { isAllowedAddress, parseNetworks } from './core/network.ts';
import {
  articleCounts,
  baselineSettings,
  getIntro,
  getSettings,
  getSourcesConfig,
  interests,
  restoreVersion,
  saveSettings,
  saveSourcesConfig,
  setIntro,
  settingsHistory,
} from './core/store.ts';
import { serverT } from './core/i18n.ts';
import { berlinDay } from './core/time.ts';
import { FeedListError } from './sources/feeds.ts';
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

/**
 * Pfad so, wie ihn Router und Dateiauslieferung am Ende verstehen: dekodiert (auch mehrfach),
 * ohne Query, `\\` als `/`, doppelte Schrägstriche und `.`/`..` aufgelöst, klein geschrieben.
 */
export function normalizePath(url: string): string {
  let path = url.split(/[?#]/)[0] ?? '';
  for (let i = 0; i < 5; i++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      break;
    }
    if (decoded === path) break;
    path = decoded;
  }
  const segments: string[] = [];
  for (const seg of path.replace(/\\/g, '/').toLowerCase().split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') segments.pop();
    else segments.push(seg);
  }
  return `/${segments.join('/')}`;
}

export function isTechnikUrl(url: string): boolean {
  const path = normalizePath(url);
  return (
    path === '/technik' ||
    path.startsWith('/technik/') ||
    path.startsWith('/technik.') ||
    path === '/api/technik' ||
    path.startsWith('/api/technik/')
  );
}

export function registerTechnik(app: FastifyInstance, { db, config, now }: Deps): void {
  const networks = parseNetworks(config.technikNetworks);

  app.addHook('onRequest', async (req, reply) => {
    // Rohe URL normalisiert und zusätzlich die tatsächlich getroffene Route prüfen.
    if (!isTechnikUrl(req.url) && !isTechnikUrl(req.routeOptions.url ?? '')) return;
    if (!isAllowedAddress(networks, req.socket.remoteAddress)) {
      return reply
        .code(403)
        .type('text/plain; charset=utf-8')
        .send(serverT('technik.errors.network'));
    }
  });

  app.get('/api/technik/status', async (): Promise<TechnikStatus> => {
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
      calibratedAt:
        settingsHistory(db, config.settings, 200).find(
          (v) => v.source === 'kalibrierung' || v.source === 'einfuehrung',
        )?.savedAt ?? null,
      intro: getIntro(db),
      ai: {
        provider: config.openrouterApiKey ? 'openrouter' : null,
        model: config.openrouterApiKey ? config.openrouterModel : null,
        fallbackModel: config.openrouterApiKey ? config.openrouterFallbackModel : null,
        dailyLimit: config.summaryDailyLimit,
        today: aiUsage(db, berlinDay(now())),
        editionWithAi: edition.articles.filter((a) => a.summaryAi).length,
      },
    };
  });

  app.get('/api/technik/settings', async () => ({
    current: getSettings(db, config.settings),
    baseline: baselineSettings(db, config.settings),
    history: settingsHistory(db, config.settings),
  }));

  // Hilfe bei Versehen: auf eine frühere Fassung zurück (SPEC §8.7, §10).
  app.post<{ Body: { id?: unknown } }>('/api/technik/settings/restore', async (req, reply) => {
    const id = typeof req.body?.id === 'number' ? req.body.id : NaN;
    const restored = Number.isInteger(id)
      ? restoreVersion(db, id, config.settings, now().toISOString())
      : null;
    if (!restored) return reply.code(404).send({ error: 'not_found' });
    return restored;
  });

  // Beim Einrichten: Anrede (SPEC §8.7) und Rubriken-Mix (Technik).
  app.put<{ Body: { salutation?: unknown; sections?: unknown } }>(
    '/api/technik/settings',
    async (req) => {
      const body = req.body ?? {};
      const patch = {
        ...('salutation' in body ? { salutation: body.salutation } : {}),
        ...('sections' in body ? { sections: body.sections } : {}),
      };
      return saveSettings(db, patch, config.settings, now().toISOString(), 'technik');
    },
  );

  app.get('/api/technik/sources', async () => getSourcesConfig(db, config));

  app.put('/api/technik/sources', async (req, reply) => {
    try {
      return saveSourcesConfig(db, req.body, config);
    } catch (err) {
      // Code und Werte übersetzt der Technik-Bereich selbst (SPEC §11).
      if (err instanceof FeedListError)
        return reply.code(400).send({ error: 'invalid', code: err.code, params: err.params });
      throw err;
    }
  });

  // Nur die gelernten Themen-Gewichte, kein Leseprotokoll (SPEC §10).
  app.get('/api/technik/interests', async () => ({
    enabled: getSettings(db, config.settings).interestLearning,
    interests: interests(db, now()),
  }));

  // Einführung beim nächsten Öffnen erneut zeigen.
  app.post('/api/technik/intro/reset', async () => {
    setIntro(db, { state: 'neu', step: 1 });
    return getIntro(db);
  });
}
