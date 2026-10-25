import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { openDb } from '../src/core/db.ts';
import { hostChecker, hostOf } from '../src/core/hosts.ts';
import { testConfig } from './helpers.ts';

const addresses = () => new Set(['127.0.0.1', '::1', '192.168.178.40', '100.80.1.2', 'fd7a::5']);

describe('Host-Prüfung gegen DNS-Rebinding (ADR 013)', () => {
  it('liest den Namen ohne Port', () => {
    expect(hostOf('Pi:8080')).toBe('pi');
    expect(hostOf('[fd7a::5]:8080')).toBe('fd7a::5');
    expect(hostOf('pi.local.')).toBe('pi.local');
    expect(hostOf(undefined)).toBe(null);
  });

  it('erlaubt eigene Adressen, Hostname, localhost und konfigurierte Namen', () => {
    const ok = hostChecker(['pi.tail1234.ts.net', '.fritz.box'], { hostname: 'pi', addresses });
    for (const h of [
      'localhost:8080',
      '127.0.0.1:8080',
      '[::1]:8080',
      '192.168.178.40:8080',
      '100.80.1.2',
      '[fd7a::5]',
      'pi:8080',
      'PI.local',
      'pi.tail1234.ts.net',
      'pi.fritz.box:8080',
      'app.localhost',
    ])
      expect(ok(h), h).toBe(true);
    for (const h of [
      undefined,
      '',
      'evil.example',
      'pi.evil.example',
      'evil.example:8080',
      '192.168.178.41',
      '8.8.8.8',
      'fritz.box',
      'tail1234.ts.net',
      'pi.local.evil.example',
    ])
      expect(ok(h), String(h)).toBe(false);
  });
});

describe('API: fremde Host-Namen und Änderungen ohne JSON', () => {
  const app = () => createApp({ db: openDb(':memory:'), config: testConfig(), webDist: null });

  it('weist fremde Host-Namen ab (421), auch für die öffentliche API', async () => {
    const a = app();
    const res = await a.inject({ url: '/api/settings', headers: { host: 'evil.example:8080' } });
    expect(res.statusCode).toBe(421);
    expect(
      (await a.inject({ url: '/health', headers: { host: '127.0.0.1:8080' } })).statusCode,
    ).toBe(200);
  });

  it('nimmt Änderungen nur als application/json an (kein CSRF per Formular)', async () => {
    const a = app();
    for (const [method, url] of [
      ['POST', '/api/reading'],
      ['POST', '/api/technik/intro/reset'],
      ['PUT', '/api/settings'],
    ] as const) {
      for (const type of [
        'text/plain',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
      ]) {
        const res = await a.inject({
          method,
          url,
          headers: { 'content-type': type },
          payload: '{"settings":{"theme":"light"},"source":"nutzerin"}',
        });
        expect(res.statusCode, `${method} ${url} ${type}`).toBe(415);
      }
      const none = await a.inject({ method, url });
      expect(none.statusCode, `${method} ${url} ohne Typ`).toBe(415);
    }
    expect((await a.inject('/api/settings')).json().theme).not.toBe('light');
    const json = await a.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { settings: { theme: 'light' }, source: 'nutzerin' },
    });
    expect(json.statusCode).toBe(200);
  });
});
