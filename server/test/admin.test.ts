import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MIN_FONT_SIZE_PX } from '@augenblick/shared';
import { createApp } from '../src/app.ts';
import {
  createSessionToken,
  DEFAULT_ADMIN_NETWORKS,
  isAllowedAddress,
  LoginThrottle,
  parseNetworks,
  verifySessionToken,
} from '../src/core/auth.ts';
import { parsePin } from '../src/core/config.ts';
import { openDb } from '../src/core/db.ts';
import {
  getSettings,
  getSourcesConfig,
  logUsage,
  pruneUsage,
  usageByDay,
} from '../src/core/store.ts';
import { TEST_PIN, testConfig } from './helpers.ts';

const LOCAL = '127.0.0.1';
const TAILSCALE = '100.101.102.103';
const LAN = '192.168.1.20';

function setup(over: Parameters<typeof testConfig>[0] = {}) {
  const db = openDb(':memory:');
  const app = createApp({ db, config: testConfig(over), webDist: null });
  return { db, app };
}

async function login(app: ReturnType<typeof setup>['app'], remoteAddress = LOCAL): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: { pin: TEST_PIN },
    remoteAddress,
  });
  expect(res.statusCode).toBe(200);
  const cookie = String(res.headers['set-cookie']).split(';')[0];
  expect(cookie).toMatch(/^augenblick_admin=/);
  return cookie!;
}

describe('Netze und Sitzung', () => {
  it('erlaubt Loopback und Tailscale, nicht das Heimnetz', () => {
    const bl = parseNetworks(DEFAULT_ADMIN_NETWORKS);
    expect(isAllowedAddress(bl, LOCAL)).toBe(true);
    expect(isAllowedAddress(bl, '::ffff:127.0.0.1')).toBe(true);
    expect(isAllowedAddress(bl, '::1')).toBe(true);
    expect(isAllowedAddress(bl, TAILSCALE)).toBe(true);
    expect(isAllowedAddress(bl, 'fd7a:115c:a1e0::1')).toBe(true);
    expect(isAllowedAddress(bl, LAN)).toBe(false);
    expect(isAllowedAddress(bl, undefined)).toBe(false);
    expect(() => parseNetworks(['kein-netz'])).toThrow();
  });

  it('Sitzungs-Token: gültig, abgelaufen, gefälscht', () => {
    const t = createSessionToken('geheim', 1000, 1);
    expect(verifySessionToken('geheim', t, 2000)).toBe(true);
    expect(verifySessionToken('geheim', t, 1000 + 2 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(verifySessionToken('anderes', t, 2000)).toBe(false);
    expect(verifySessionToken('geheim', t.replace(/.$/, '0'), 2000)).toBe(t.endsWith('0'));
  });

  it('sperrt nach 5 falschen PINs für 15 Minuten', () => {
    let now = 0;
    const th = new LoginThrottle(5, 15 * 60 * 1000, () => now);
    for (let i = 0; i < 4; i++) th.fail();
    expect(th.locked()).toBe(false);
    th.fail();
    expect(th.locked()).toBe(true);
    now = 15 * 60 * 1000 + 1;
    expect(th.locked()).toBe(false);
  });

  it('PIN braucht mindestens 4 Ziffern', () => {
    expect(parsePin('1234')).toBe('1234');
    expect(parsePin('12')).toBeNull();
    expect(parsePin('bitte-aendern')).toBeNull();
    expect(parsePin(undefined)).toBeNull();
  });
});

describe('Admin-API', () => {
  it('aus dem Heimnetz gesperrt, auch mit PIN', async () => {
    const { app } = setup();
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { pin: TEST_PIN },
      remoteAddress: LAN,
    });
    expect(res.statusCode).toBe(403);
    expect((await app.inject({ url: '/admin', remoteAddress: LAN })).statusCode).toBe(403);
  });

  it('ohne Anmeldung kein Zugriff, falsche PIN abgewiesen', async () => {
    const { app } = setup();
    expect((await app.inject({ url: '/api/admin/status', remoteAddress: LOCAL })).statusCode).toBe(
      401,
    );
    const bad = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { pin: '0000' },
      remoteAddress: LOCAL,
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.headers['set-cookie']).toBeUndefined();
  });

  it('nach 5 Fehlversuchen gesperrt', async () => {
    const { app } = setup();
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/admin/login',
        payload: { pin: '0000' },
        remoteAddress: LOCAL,
      });
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { pin: TEST_PIN },
      remoteAddress: LOCAL,
    });
    expect(res.statusCode).toBe(429);
  });

  it('ohne konfigurierte PIN bleibt der Admin-Bereich zu', async () => {
    const { app } = setup({ adminPin: null });
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { pin: '' },
      remoteAddress: LOCAL,
    });
    expect(res.statusCode).toBe(503);
  });

  it('Sitzungs-Cookie ist HttpOnly und SameSite=Strict', async () => {
    const { app } = setup();
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { pin: TEST_PIN },
      remoteAddress: TAILSCALE,
    });
    expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly; SameSite=Strict/);
  });

  it('Einstellungen speichern: begrenzt und wirksam für das Tablet', async () => {
    const { app } = setup();
    const cookie = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      remoteAddress: LOCAL,
      headers: { cookie },
      payload: {
        fontSizePx: 10,
        letterSpacingEm: 0.3,
        theme: 'light',
        unbekannt: 1,
        lineHeight: 'x',
      },
    });
    expect(res.statusCode).toBe(200);
    const saved = res.json();
    expect(saved.fontSizePx).toBe(MIN_FONT_SIZE_PX);
    expect(saved.letterSpacingEm).toBe(0.05);
    expect(saved.theme).toBe('light');
    expect(saved.lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
    expect(saved.unbekannt).toBeUndefined();
    const tablet = (await app.inject('/api/settings')).json();
    expect(tablet).toEqual(saved);
  });

  it('Kalibrierung setzt Schriftgröße und Schema und merkt sich das Datum', async () => {
    const { app } = setup();
    const cookie = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/calibration',
      remoteAddress: LOCAL,
      headers: { cookie },
      payload: { fontSizePx: 38, theme: 'light' },
    });
    expect(res.json()).toMatchObject({ fontSizePx: 38, theme: 'light' });
    const status = (
      await app.inject({ url: '/api/admin/status', remoteAddress: LOCAL, headers: { cookie } })
    ).json();
    expect(status.calibratedAt).toEqual(expect.any(String));
    expect((await app.inject('/api/settings')).json()).toMatchObject({
      fontSizePx: 38,
      theme: 'light',
    });
  });

  it('Quellen: Feed-Adresse ändern, ungültige abweisen', async () => {
    const { app, db } = setup();
    const cookie = await login(app);
    const put = (payload: unknown) =>
      app.inject({
        method: 'PUT',
        url: '/api/admin/sources',
        remoteAddress: LOCAL,
        headers: { cookie },
        payload: payload as object,
      });
    expect((await put({ br24FeedUrl: 'javascript:alert(1)' })).statusCode).toBe(400);
    const ok = await put({ br24FeedUrl: 'https://example.org/franken.xml' });
    expect(ok.json()).toMatchObject({
      br24FeedUrl: 'https://example.org/franken.xml',
      usageLogEnabled: true,
    });
    expect(getSourcesConfig(db, testConfig()).br24FeedUrl).toBe('https://example.org/franken.xml');
  });

  it('Rubriken-Mix wird gespeichert und bereinigt', async () => {
    const { app, db } = setup();
    const cookie = await login(app);
    await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      remoteAddress: LOCAL,
      headers: { cookie },
      payload: {
        sections: [
          { key: 'Region', sections: ['region', ' sport '], count: 99 },
          { key: '', sections: [] },
        ],
      },
    });
    expect(getSettings(db, DEFAULT_SETTINGS).sections).toEqual([
      { key: 'region', sections: ['region', 'sport'], count: 12 },
    ]);
  });
});

describe('Nutzungsprotokoll', () => {
  it('nimmt gültige Meldungen an und fasst je Tag zusammen', async () => {
    const { app, db } = setup();
    const send = (payload: unknown) =>
      app.inject({ method: 'POST', url: '/api/usage', payload: payload as object });
    expect(
      (await send({ articleId: 'demo-markt', pagesSeen: 3, pagesTotal: 5, seconds: 240 }))
        .statusCode,
    ).toBe(204);
    expect(
      (await send({ articleId: 'demo-chor', pagesSeen: 9, pagesTotal: 2, seconds: 99999 }))
        .statusCode,
    ).toBe(204);
    expect(
      (await send({ articleId: '../etc', pagesSeen: 1, pagesTotal: 1, seconds: 1 })).statusCode,
    ).toBe(400);
    const days = usageByDay(db, 14);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ articles: 2, pages: 5, minutes: 124 });
  });

  it('abgeschaltet: nichts wird gespeichert', async () => {
    const { app, db } = setup();
    const cookie = await login(app);
    await app.inject({
      method: 'PUT',
      url: '/api/admin/sources',
      remoteAddress: LOCAL,
      headers: { cookie },
      payload: { usageLogEnabled: false },
    });
    await app.inject({
      method: 'POST',
      url: '/api/usage',
      payload: { articleId: 'a', pagesSeen: 1, pagesTotal: 1, seconds: 10 },
    });
    expect(usageByDay(db, 14)).toEqual([]);
  });

  it('löscht alte Einträge', () => {
    const db = openDb(':memory:');
    logUsage(
      db,
      { articleId: 'a', pagesSeen: 1, pagesTotal: 1, seconds: 60 },
      new Date('2026-01-01T10:00:00Z'),
    );
    logUsage(
      db,
      { articleId: 'b', pagesSeen: 1, pagesTotal: 1, seconds: 60 },
      new Date('2026-10-24T10:00:00Z'),
    );
    expect(pruneUsage(db, new Date('2026-10-24T12:00:00Z'), 180)).toBe(1);
    expect(usageByDay(db, 14).map((d) => d.day)).toEqual(['2026-10-24']);
  });
});
