import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MIN_FONT_SIZE_PX } from '@augenblick/shared';
import { createApp } from '../src/app.ts';
import { openDb, saveEdition, upsertArticle } from '../src/core/db.ts';
import { DEFAULT_TECHNIK_NETWORKS, isAllowedAddress, parseNetworks } from '../src/core/network.ts';
import { addTopicPoints, decay, HALF_LIFE_DAYS, interests } from '../src/core/store.ts';
import { makeArticle, testConfig } from './helpers.ts';

const LAN = '192.168.1.20';
const TAILSCALE = '100.101.102.103';
const INTERNET = '203.0.113.7';
const NOW = new Date('2026-10-24T08:00:00.000Z');

function setup() {
  const db = openDb(':memory:');
  const app = createApp({ db, config: testConfig(), webDist: null, now: () => NOW });
  return { db, app };
}

describe('Technik-Bereich: Netz statt PIN', () => {
  it('erlaubt Heimnetz, Tailscale und dieses Gerät, nicht das Internet', () => {
    const bl = parseNetworks(DEFAULT_TECHNIK_NETWORKS);
    for (const ok of [
      '127.0.0.1',
      '::1',
      '::ffff:192.168.0.5',
      LAN,
      '10.1.2.3',
      '172.20.0.1',
      TAILSCALE,
      'fd12::1',
    ]) {
      expect(isAllowedAddress(bl, ok), ok).toBe(true);
    }
    for (const no of [INTERNET, '8.8.8.8', '2001:db8::1', undefined])
      expect(isAllowedAddress(bl, no)).toBe(false);
    expect(() => parseNetworks(['kein-netz'])).toThrow();
  });

  it('ohne PIN aus dem Heimnetz erreichbar, aus dem Internet gesperrt', async () => {
    const { app } = setup();
    expect((await app.inject({ url: '/api/technik/status', remoteAddress: LAN })).statusCode).toBe(
      200,
    );
    expect(
      (await app.inject({ url: '/api/technik/status', remoteAddress: TAILSCALE })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: '/api/technik/status', remoteAddress: INTERNET })).statusCode,
    ).toBe(403);
    expect((await app.inject({ url: '/technik', remoteAddress: INTERNET })).statusCode).toBe(403);
  });

  it('jede Schreibweise des Pfads ist aus dem Internet gesperrt', async () => {
    const { app } = setup();
    const variants = [
      '/api/%74echnik/status',
      '/api/%74%65%63%68%6e%69%6b/status',
      '/api/%2574echnik/status',
      '/api%2Ftechnik/status',
      '//api//technik//status',
      '/api/./technik/status',
      '/api/x/../technik/status',
      '/API/Technik/Status',
      '/api/technik/status?x=1',
      '/api/technik/status#a',
      '/%74echnik',
      '/technik/',
      '/Technik.html',
      '/technik.html?a=b',
    ];
    for (const url of variants) {
      const res = await app.inject({ url, remoteAddress: INTERNET });
      expect(res.statusCode, url).toBe(403);
    }
    // Aus dem Heimnetz bleibt die normale Adresse erreichbar.
    expect(
      (await app.inject({ url: '/api/%74echnik/status', remoteAddress: LAN })).statusCode,
    ).toBe(200);
  });

  it('Status: Version, Ausgabe, Einführung, KI aus ohne Schlüssel', async () => {
    const { app } = setup();
    const s = (await app.inject({ url: '/api/technik/status', remoteAddress: LAN })).json();
    expect(s).toMatchObject({ intro: { state: 'neu' }, ai: { provider: null, dailyLimit: 40 } });
  });
});

describe('Einstellungen der Nutzerin (SPEC §8.7)', () => {
  const put = (app: ReturnType<typeof setup>['app'], settings: unknown, source = 'nutzerin') =>
    app.inject({ method: 'PUT', url: '/api/settings', payload: { settings, source } });

  it('speichert ohne PIN, begrenzt Werte und übernimmt keine Technik-Felder', async () => {
    const { app } = setup();
    const res = await put(app, {
      fontSizePx: 10,
      theme: 'light',
      letterSpacingEm: 1,
      sections: [],
      salutation: 'du',
    });
    expect(res.statusCode).toBe(200);
    const s = res.json();
    expect(s.fontSizePx).toBe(MIN_FONT_SIZE_PX);
    expect(s.letterSpacingEm).toBe(0.05);
    expect(s.theme).toBe('light');
    expect(s.sections).toEqual(DEFAULT_SETTINGS.sections);
    expect(s.salutation).toBe('sie');
    expect((await app.inject('/api/settings')).json()).toEqual(s);
  });

  it('verlangt eine bekannte Herkunft', async () => {
    const { app } = setup();
    expect((await put(app, { theme: 'light' }, 'technik')).statusCode).toBe(400);
    expect((await put(app, { theme: 'light' }, 'irgendwas')).statusCode).toBe(400);
  });

  it('„Wie am Anfang“ holt die zuletzt kalibrierten Werte, nicht spätere Änderungen', async () => {
    const { app } = setup();
    expect((await app.inject('/api/settings/baseline')).json().fontSizePx).toBe(
      DEFAULT_SETTINGS.fontSizePx,
    );
    await put(app, { fontSizePx: 38, theme: 'light' }, 'einfuehrung');
    await put(app, { fontSizePx: 60, theme: 'dark', interestLearning: true }, 'nutzerin');
    const base = (await app.inject('/api/settings/baseline')).json();
    expect(base).toMatchObject({ fontSizePx: 38, theme: 'light', interestLearning: true });
  });

  it('Technik-Bereich: Verlauf ansehen und auf eine frühere Fassung zurück', async () => {
    const { app } = setup();
    await put(app, { fontSizePx: 38 }, 'kalibrierung');
    await put(app, { fontSizePx: 76 });
    const view = (await app.inject({ url: '/api/technik/settings', remoteAddress: LAN })).json();
    expect(view.current.fontSizePx).toBe(76);
    expect(view.history.map((v: { source: string }) => v.source)).toEqual([
      'nutzerin',
      'kalibrierung',
    ]);
    const older = view.history[1].id;
    const restored = await app.inject({
      method: 'POST',
      url: '/api/technik/settings/restore',
      remoteAddress: LAN,
      payload: { id: older },
    });
    expect(restored.json().fontSizePx).toBe(38);
    expect((await app.inject('/api/settings')).json().fontSizePx).toBe(38);
    const after = (await app.inject({ url: '/api/technik/settings', remoteAddress: LAN })).json();
    expect(after.history[0].source).toBe('technik');
  });

  it('Zurücksetzen durch den Betreuer lässt das Einverständnis der Leserin, wie es ist', async () => {
    const restore = async (app: ReturnType<typeof setup>['app'], id: number) =>
      (
        await app.inject({
          method: 'POST',
          url: '/api/technik/settings/restore',
          remoteAddress: LAN,
          payload: { id },
        })
      ).json();
    const history = async (app: ReturnType<typeof setup>['app']) =>
      (await app.inject({ url: '/api/technik/settings', remoteAddress: LAN })).json().history;

    // Früher eingewilligt, inzwischen zurückgezogen → bleibt zurückgezogen.
    const { app } = setup();
    await put(app, { fontSizePx: 38, interestLearning: true }, 'einfuehrung');
    await put(app, { fontSizePx: 60, interestLearning: false });
    const withConsent = (await history(app))[1].id;
    const restored = await restore(app, withConsent);
    expect(restored).toMatchObject({ fontSizePx: 38, interestLearning: false });

    // Früher abgelehnt bzw. nie gefragt, inzwischen eingewilligt → bleibt eingewilligt.
    const b = setup().app;
    await put(b, { fontSizePx: 38 }, 'einfuehrung');
    await put(b, { interestLearning: true });
    const before = (await history(b))[1].id;
    expect(await restore(b, before)).toMatchObject({ fontSizePx: 38, interestLearning: true });
    expect((await b.inject('/api/settings')).json().interestLearning).toBe(true);
  });

  it('Zurücksetzen holt Anrede und Rubriken als Technik zurück', async () => {
    const { app } = setup();
    await put(app, { fontSizePx: 38 }, 'einfuehrung');
    const first = (await app.inject({ url: '/api/technik/settings', remoteAddress: LAN })).json()
      .history[0].id;
    await app.inject({
      method: 'PUT',
      url: '/api/technik/settings',
      remoteAddress: LAN,
      payload: { salutation: 'du' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/technik/settings/restore',
      remoteAddress: LAN,
      payload: { id: first },
    });
    expect(res.json().salutation).toBe('sie');
  });

  it('„Schrift einstellen“ allein ändert „Wie am Anfang“ nicht', async () => {
    const { app } = setup();
    await put(app, { fontSizePx: 38 }, 'einfuehrung');
    await put(app, { fontSizePx: 76 }, 'nutzerin');
    expect((await app.inject('/api/settings/baseline')).json().fontSizePx).toBe(38);
  });

  it('Technik-Bereich: Anrede und Rubriken-Mix beim Einrichten', async () => {
    const { app } = setup();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/technik/settings',
      remoteAddress: LAN,
      payload: {
        salutation: 'du',
        sections: [{ key: 'Region', sections: ['region'], count: 99 }],
        fontSizePx: 99,
      },
    });
    expect(res.json()).toMatchObject({
      salutation: 'du',
      sections: [{ key: 'region', sections: ['region'], count: 12 }],
      fontSizePx: DEFAULT_SETTINGS.fontSizePx,
    });
  });

  it('Quellen: Feed-Liste ändern, ungültige abweisen', async () => {
    const { app } = setup();
    const send = (payload: object) =>
      app.inject({ method: 'PUT', url: '/api/technik/sources', remoteAddress: LAN, payload });
    const get = () => app.inject({ url: '/api/technik/sources', remoteAddress: LAN });
    expect((await get()).json()).toEqual({ feeds: ['br24-mittelfranken'] });
    expect((await send({ feeds: ['javascript:alert(1)'] })).statusCode).toBe(400);
    expect((await send({ feeds: 'br24-mittelfranken' })).statusCode).toBe(400);
    expect(
      (
        await send({
          feeds: ['br24-mittelfranken', ' https://example.org/franken.xml ', 'br24-mittelfranken'],
        })
      ).json(),
    ).toEqual({ feeds: ['br24-mittelfranken', 'https://example.org/franken.xml'] });
    // Katalog-Adresse wird auf den Kurznamen abgebildet
    expect(
      (await send({ feeds: ['https://nachrichtenfeeds.br.de/rdf/boards/UZlJdUE'] })).json(),
    ).toEqual({ feeds: ['br24-oberbayern'] });
  });
});

describe('Einführung (SPEC §8.8)', () => {
  it('merkt sich den Fortschritt, der Betreuer kann sie neu starten', async () => {
    const { app } = setup();
    expect((await app.inject('/api/intro')).json()).toEqual({ state: 'neu', step: 1 });
    await app.inject({ method: 'PUT', url: '/api/intro', payload: { state: 'pausiert', step: 4 } });
    expect((await app.inject('/api/intro')).json()).toEqual({ state: 'pausiert', step: 4 });
    expect(
      (await app.inject({ method: 'PUT', url: '/api/intro', payload: { state: 'quatsch' } }))
        .statusCode,
    ).toBe(400);
    await app.inject({ method: 'POST', url: '/api/technik/intro/reset', remoteAddress: LAN });
    expect((await app.inject('/api/intro')).json().state).toBe('neu');
  });
});

describe('Interessen lernen (SPEC §5.3)', () => {
  function withArticle() {
    const ctx = setup();
    const a = makeArticle({
      id: 'tagesschau-garten',
      section: 'region',
      topics: ['Garten', 'Natur'],
    });
    upsertArticle(ctx.db, a);
    saveEdition(ctx.db, '2026-10-24', [a.id], NOW.toISOString());
    return ctx;
  }
  const consent = (app: ReturnType<typeof setup>['app'], v: boolean) =>
    app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { settings: { interestLearning: v }, source: 'nutzerin' },
    });
  const read = (app: ReturnType<typeof setup>['app'], body: object) =>
    app.inject({
      method: 'POST',
      url: '/api/reading',
      payload: { articleId: 'tagesschau-garten', ...body },
    });

  it('ohne Einverständnis wird nichts gelernt', async () => {
    const { app, db } = withArticle();
    expect((await read(app, { reachedEnd: true, seconds: 300 })).statusCode).toBe(204);
    expect(interests(db, NOW)).toEqual([]);
    expect((await app.inject('/api/interests')).json()).toEqual([]);
  });

  it('mit Einverständnis: Themen aus Rubrik und Schlagworten bekommen Punkte', async () => {
    const { app } = withArticle();
    await consent(app, true);
    await read(app, { reachedEnd: true, seconds: 300 });
    await read(app, { reachedEnd: false, seconds: 5 });
    const list = (await app.inject('/api/interests')).json();
    expect(list.map((i: { topic: string }) => i.topic).sort()).toEqual([
      'Garten',
      'Natur',
      'Region',
    ]);
    expect(list[0].weight).toBe(3); // 1 + 3 − 1
  });

  it('„mehr davon“, „weniger davon“, „Alles vergessen“', async () => {
    const { app } = withArticle();
    await consent(app, true);
    await read(app, { reachedEnd: true, seconds: 300 });
    const adjusted = (
      await app.inject({
        method: 'PUT',
        url: '/api/interests',
        payload: { adjust: { Garten: 1, natur: -1 } },
      })
    ).json();
    const w = Object.fromEntries(
      adjusted.map((i: { topic: string; weight: number }) => [i.topic, i.weight]),
    );
    expect(w.Garten).toBe(7);
    expect(w.Natur).toBe(1);
    expect(
      (
        await app.inject({ method: 'PUT', url: '/api/interests', payload: { forgetAll: true } })
      ).json(),
    ).toEqual([]);
  });

  it('Einverständnis zurückgezogen: Gelerntes wird gelöscht', async () => {
    const { app, db } = withArticle();
    await consent(app, true);
    await read(app, { reachedEnd: true, seconds: 300 });
    await consent(app, false);
    expect(interests(db, NOW)).toEqual([]);
  });

  it('ungültige Signale werden abgewiesen', async () => {
    const { app } = withArticle();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/reading',
          payload: { articleId: '../x', seconds: 1 },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('Gewichte vergessen langsam (Halbwertszeit 30 Tage), keine Artikelliste', () => {
    const db = openDb(':memory:');
    addTopicPoints(db, ['Garten'], 8, NOW);
    const later = new Date(NOW.getTime() + HALF_LIFE_DAYS * 24 * 60 * 60 * 1000);
    expect(interests(db, later)).toEqual([{ topic: 'Garten', weight: 4 }]);
    expect(decay(8, NOW.toISOString(), later)).toBeCloseTo(4);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[];
    expect(tables.map((t) => t.name)).not.toContain('usage_log');
  });

  it('der Technik-Bereich sieht nur Themen-Gewichte', async () => {
    const { app } = withArticle();
    await consent(app, true);
    await read(app, { reachedEnd: true, seconds: 300 });
    const res = (await app.inject({ url: '/api/technik/interests', remoteAddress: LAN })).json();
    expect(res.enabled).toBe(true);
    expect(Object.keys(res.interests[0]).sort()).toEqual(['topic', 'weight']);
  });
});
