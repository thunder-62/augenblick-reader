import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@augenblick/shared';
import { createApp } from '../src/app.ts';
import { openDb, saveEdition, upsertArticle } from '../src/core/db.ts';
import { makeArticle, testConfig } from './helpers.ts';

function setup() {
  const db = openDb(':memory:');
  const a = makeArticle({ id: 'tagesschau-eins' });
  const failed = makeArticle({ id: 'tagesschau-kaputt', status: 'failed' });
  upsertArticle(db, a);
  upsertArticle(db, failed);
  saveEdition(db, '2026-10-24', [a.id, failed.id, 'gibt-es-nicht'], '2026-10-24T06:00:00.000Z');
  return { app: createApp({ db, config: testConfig(), webDist: null }), a };
}

describe('API', () => {
  it('GET /health', async () => {
    const { app } = setup();
    const res = await app.inject('/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', edition: { day: '2026-10-24', articles: 1 } });
  });

  it('GET /api/edition liefert nur fertige, vorhandene Artikel als Karten', async () => {
    const { app, a } = setup();
    const res = await app.inject('/api/edition');
    const body = res.json();
    expect(res.headers['cache-control']).toBe('no-store');
    expect(body.articles).toHaveLength(1);
    expect(body.articles[0]).toMatchObject({ id: a.id, title: a.title, readingMinutes: 1 });
    expect(body.articles[0].blocks).toBeUndefined();
  });

  it('GET /api/articles/:id', async () => {
    const { app, a } = setup();
    expect((await app.inject(`/api/articles/${a.id}`)).json()).toMatchObject({
      id: a.id,
      blocks: a.blocks,
    });
    expect((await app.inject('/api/articles/tagesschau-kaputt')).statusCode).toBe(404);
    expect((await app.inject('/api/articles/unbekannt')).statusCode).toBe(404);
  });

  it('GET /api/settings', async () => {
    const { app } = setup();
    expect((await app.inject('/api/settings')).json()).toEqual(DEFAULT_SETTINGS);
  });

  it('leere Datenbank: leere Ausgabe statt Fehler', async () => {
    const app = createApp({ db: openDb(':memory:'), config: testConfig(), webDist: null });
    expect((await app.inject('/api/edition')).json()).toEqual({
      day: null,
      updatedAt: null,
      articles: [],
    });
  });
});
