import { describe, expect, it } from 'vitest';
import { DEFAULT_SECTIONS } from '@augenblick/shared';
import {
  cleanup,
  getArticle,
  latestEdition,
  openDb,
  saveEdition,
  sourceStatuses,
  upsertArticle,
} from '../src/core/db.ts';
import { runPipeline } from '../src/core/pipeline.ts';
import { DemoAdapter } from '../src/sources/demo.ts';
import type { RawArticle, RawItem, SourceAdapter } from '../src/sources/types.ts';
import { makeArticle } from './helpers.ts';

const NOW = new Date('2026-10-24T06:00:00.000Z');
const opts = {
  sections: DEFAULT_SECTIONS,
  maxArticlesPerRun: 20,
  retentionDays: 7,
  now: () => NOW,
};

class BrokenAdapter implements SourceAdapter {
  readonly id = 'kaputt';
  async fetchList(): Promise<RawItem[]> {
    throw new Error('Quelle nicht erreichbar');
  }
  async fetchArticle(): Promise<RawArticle> {
    throw new Error('nie');
  }
}

/** Liefert eine Liste, aber ein Artikel ist kaputt. */
class PartlyBrokenAdapter extends DemoAdapter {
  override readonly id = 'teilweise';
  override async fetchArticle(item: RawItem): Promise<RawArticle> {
    if (item.id === 'markt') throw new Error('Seite kaputt');
    return super.fetchArticle(item);
  }
}

describe('Pipeline', () => {
  it('verarbeitet Artikel und stellt eine Ausgabe zusammen', async () => {
    const db = openDb(':memory:');
    const report = await runPipeline(db, [new DemoAdapter(() => NOW)], opts);
    expect(report.sources[0]).toMatchObject({ source: 'demo', listed: 8, added: 8, failed: 0 });
    const edition = latestEdition(db);
    expect(edition.day).toBe('2026-10-24');
    expect(edition.articles).toHaveLength(8);
    const article = getArticle(db, 'demo-markt');
    expect(article?.status).toBe('ready');
    expect(article?.summary?.model).toBe('fallback-erste-saetze');
    const first = article?.blocks[0];
    expect(first?.type === 'paragraph' && first.sentences.slice(0, 2).join(' ')).toBe(
      article?.summary?.text,
    );
    expect(article?.readingMinutes).toBeGreaterThanOrEqual(3);
  });

  it('eine ausgefallene Quelle blockiert die anderen nicht', async () => {
    const db = openDb(':memory:');
    const report = await runPipeline(db, [new BrokenAdapter(), new DemoAdapter(() => NOW)], opts);
    expect(report.sources[0]?.error).toMatch(/nicht erreichbar/);
    expect(latestEdition(db).articles).toHaveLength(8);
    const status = sourceStatuses(db).find((s) => s.source === 'kaputt');
    expect(status?.lastError).toMatch(/nicht erreichbar/);
    expect(status?.lastSuccessAt).toBeNull();
  });

  it('ein kaputter Artikel blockiert die Übersicht nicht', async () => {
    const db = openDb(':memory:');
    const report = await runPipeline(db, [new PartlyBrokenAdapter(() => NOW)], opts);
    expect(report.sources[0]).toMatchObject({ added: 7, failed: 1 });
    expect(latestEdition(db).articles).toHaveLength(7);
  });

  it('ohne Neues bleibt die letzte Ausgabe sichtbar', async () => {
    const db = openDb(':memory:');
    await runPipeline(db, [new DemoAdapter(() => NOW)], opts);
    const later = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000);
    await runPipeline(db, [new BrokenAdapter()], { ...opts, now: () => later });
    const edition = latestEdition(db);
    expect(edition.day).toBe('2026-10-24');
    expect(edition.articles).toHaveLength(8);
  });

  it('holt bekannte Artikel nicht erneut ab', async () => {
    const db = openDb(':memory:');
    await runPipeline(db, [new DemoAdapter(() => NOW)], opts);
    const report = await runPipeline(db, [new DemoAdapter(() => NOW)], opts);
    expect(report.sources[0]).toMatchObject({ listed: 8, added: 0 });
  });
});

describe('Datenbank', () => {
  it('räumt Artikel älter als 7 Tage auf, außer die der neuesten Ausgabe', () => {
    const db = openDb(':memory:');
    const old = makeArticle({
      publishedAt: '2026-10-01T06:00:00.000Z',
      fetchedAt: '2026-10-01T06:00:00.000Z',
    });
    const oldInEdition = makeArticle({
      publishedAt: '2026-10-02T06:00:00.000Z',
      fetchedAt: '2026-10-02T06:00:00.000Z',
    });
    const fresh = makeArticle({ publishedAt: '2026-10-23T06:00:00.000Z' });
    for (const a of [old, oldInEdition, fresh]) upsertArticle(db, a);
    saveEdition(db, '2026-10-01', [old.id], '2026-10-01T06:00:00.000Z');
    saveEdition(db, '2026-10-02', [oldInEdition.id], '2026-10-02T06:00:00.000Z');
    const removed = cleanup(db, NOW, 7);
    expect(removed).toEqual({ articles: 1, editions: 1 });
    expect(getArticle(db, old.id)).toBeNull();
    expect(getArticle(db, oldInEdition.id)).not.toBeNull();
    expect(getArticle(db, fresh.id)).not.toBeNull();
  });

  it('Migrationen sind wiederholbar', () => {
    const db = openDb(':memory:');
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    upsertArticle(db, makeArticle());
    expect(() => openDb(':memory:')).not.toThrow();
  });
});
