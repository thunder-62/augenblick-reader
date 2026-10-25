import { describe, expect, it } from 'vitest';
import {
  assertPublicUrl,
  BlockedFetchError,
  getText,
  isPublicAddress,
  MAX_RESPONSE_BYTES,
  type FetchLike,
  type LookupLike,
} from '../src/core/http.ts';

const PUBLIC = '93.184.215.14';

/** Gefälschte DNS-Auflösung: Name → Adresse. */
function dns(map: Record<string, string>): LookupLike {
  return async (host) => {
    const address = map[host];
    if (!address) throw new Error(`ENOTFOUND ${host}`);
    return [{ address, family: address.includes(':') ? 6 : 4 }];
  };
}

function routes(map: Record<string, () => Response>, calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    return map[url]?.() ?? new Response('nicht gefunden', { status: 404 });
  };
}

describe('Zielprüfung für Abrufe (SSRF)', () => {
  it('erkennt nicht öffentliche Adressen', () => {
    for (const a of [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.5.4',
      '192.168.178.1',
      '169.254.169.254',
      '100.64.0.1',
      '100.101.102.103',
      '224.0.0.1',
      '0.0.0.0',
      '::1',
      '::',
      'fd00::1',
      'fe80::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '::ffff:192.168.0.1',
    ])
      expect(isPublicAddress(a), a).toBe(false);
    for (const a of [PUBLIC, '8.8.8.8', '2606:2800:220:1:248:1893:25c8:1946'])
      expect(isPublicAddress(a), a).toBe(true);
  });

  it('weist lokale, private und Metadaten-Ziele ab – auch als Name', async () => {
    const lookup = dns({
      'intern.example': '192.168.1.10',
      'meta.example': '169.254.169.254',
      'tailnet.example': '100.100.1.2',
      'v6.example': 'fd12::5',
      'gut.example': PUBLIC,
    });
    for (const url of [
      'http://127.0.0.1/feed',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/',
      'http://localhost/',
      'http://pi.localhost/',
      'http://LOCALHOST./',
      'http://intern.example/',
      'http://meta.example/',
      'http://tailnet.example/',
      'http://v6.example/',
      'http://2130706433/', // 127.0.0.1 als Zahl
      'http://0x7f.1/',
      'ftp://gut.example/',
      'file:///etc/passwd',
      'http://gut.example:8080/',
      'http://nutzer:pw@gut.example/',
    ])
      await expect(assertPublicUrl(url, lookup), url).rejects.toBeInstanceOf(BlockedFetchError);
    await expect(assertPublicUrl('https://gut.example/feed', lookup)).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl('http://gut.example:80/', lookup)).resolves.toBeInstanceOf(URL);
  });

  it('weist ab, wenn ein Name auch auf eine private Adresse zeigt', async () => {
    const lookup: LookupLike = async () => [
      { address: PUBLIC, family: 4 },
      { address: '10.0.0.5', family: 4 },
    ];
    await expect(assertPublicUrl('http://gemischt.example/', lookup)).rejects.toThrow(
      /10\.0\.0\.5/,
    );
  });

  it('prüft jede Weiterleitung und ruft das private Ziel nie ab', async () => {
    const lookup = dns({ 'gut.example': PUBLIC, 'boese.example': '192.168.0.1' });
    for (const target of [
      'http://127.0.0.1/admin',
      'http://192.168.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://boese.example/',
    ]) {
      const calls: string[] = [];
      const fetch = routes(
        {
          'https://gut.example/feed': () =>
            new Response(null, {
              status: 302,
              headers: { location: 'https://gut.example/weiter' },
            }),
          'https://gut.example/weiter': () =>
            new Response(null, { status: 301, headers: { location: target } }),
        },
        calls,
      );
      await expect(getText('https://gut.example/feed', { fetch, lookup })).rejects.toBeInstanceOf(
        BlockedFetchError,
      );
      expect(calls).toEqual(['https://gut.example/feed', 'https://gut.example/weiter']);
    }
  });

  it('folgt erlaubten Weiterleitungen, auch relativen, aber höchstens fünf', async () => {
    const lookup = dns({ 'gut.example': PUBLIC });
    const fetch = routes({
      'https://gut.example/a': () =>
        new Response(null, { status: 302, headers: { location: '/b' } }),
      'https://gut.example/b': () => new Response('Inhalt'),
    });
    expect(await getText('https://gut.example/a', { fetch, lookup })).toBe('Inhalt');

    const loop: FetchLike = async (url) =>
      new Response(null, { status: 302, headers: { location: `${url}x` } });
    await expect(getText('https://gut.example/', { fetch: loop, lookup })).rejects.toThrow(
      /Zu viele Weiterleitungen/,
    );
  });
});

describe('Größenbegrenzung', () => {
  const lookup = dns({ 'gut.example': PUBLIC });

  it('bricht Antworten über 5 MB ab, auch ohne Content-Length', async () => {
    let sent = 0;
    const chunk = new Uint8Array(1024 * 1024).fill(65);
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const fetch: FetchLike = async () => new Response(endless);
    await expect(getText('https://gut.example/riesig', { fetch, lookup })).rejects.toThrow(
      /zu groß/,
    );
    expect(sent).toBeLessThanOrEqual(MAX_RESPONSE_BYTES + 2 * chunk.byteLength);
  });

  it('bricht bei zu großer Content-Length sofort ab', async () => {
    const fetch: FetchLike = async () =>
      new Response('x', { headers: { 'content-length': String(MAX_RESPONSE_BYTES + 1) } });
    await expect(getText('https://gut.example/', { fetch, lookup })).rejects.toThrow(/zu groß/);
  });

  it('liest Antworten bis zur Grenze vollständig, auch mit Umlauten', async () => {
    const fetch: FetchLike = async () => new Response('Grüße aus Fürth');
    expect(await getText('https://gut.example/', { fetch, lookup })).toBe('Grüße aus Fürth');
    const small: FetchLike = async () => new Response('a'.repeat(100));
    await expect(
      getText('https://gut.example/', { fetch: small, lookup, maxBytes: 50 }),
    ).rejects.toThrow(/zu groß/);
  });
});
