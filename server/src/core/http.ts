/**
 * Abrufe von Feeds und Artikelseiten (ADR 011). Die Adressen kommen aus Feeds und dem
 * Technik-Bereich, also von außen: Vor jedem Abruf und nach jeder Weiterleitung wird das Ziel
 * geprüft, damit kein Abruf im Heimnetz oder auf dem Pi selbst landet (SSRF).
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { VERSION } from './version.ts';

export const USER_AGENT = `Augenblick/${VERSION} (privater Zeitungs-Reader; +https://github.com/thunder-62/augenblick-reader)`;

/** Größere Antworten werden abgebrochen; kein Feed und keine Artikelseite braucht mehr. */
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const MAX_REDIRECTS = 5;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type LookupLike = (hostname: string) => Promise<{ address: string; family: number }[]>;

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} für ${url}`);
  }
}

/** Ziel ist nicht erlaubt (lokal, privat, falsches Protokoll …) oder die Antwort zu groß. */
export class BlockedFetchError extends Error {}

// Nicht öffentliche Ziele: dieses Gerät, Heimnetze, Tailscale/CGNAT, Link-local, Multicast …
const BLOCKED = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  BLOCKED.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  BLOCKED.addSubnet(net, bits, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  const a = mapped ?? address;
  const family = isIP(a);
  if (family === 4) return !BLOCKED.check(a, 'ipv4');
  if (family === 6) return !BLOCKED.check(a, 'ipv6');
  return false;
}

const defaultLookup: LookupLike = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

/** Prüft Protokoll, Port, Hostname und alle aufgelösten Adressen. */
export async function assertPublicUrl(
  raw: string,
  lookup: LookupLike = defaultLookup,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedFetchError(`Keine gültige Adresse: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new BlockedFetchError(`Nur http und https erlaubt: ${raw}`);
  if (url.port !== '' && url.port !== '80' && url.port !== '443')
    throw new BlockedFetchError(`Nur die Ports 80 und 443 erlaubt: ${raw}`);
  if (url.username || url.password)
    throw new BlockedFetchError(`Keine Zugangsdaten in Adressen: ${raw}`);
  const host = url.hostname
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost'))
    throw new BlockedFetchError(`Lokales Ziel nicht erlaubt: ${raw}`);
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host);
  if (!addresses.length) throw new BlockedFetchError(`Adresse nicht auflösbar: ${raw}`);
  const bad = addresses.find((a) => !isPublicAddress(a.address));
  if (bad) throw new BlockedFetchError(`Ziel ${bad.address} ist nicht öffentlich: ${raw}`);
  return url;
}

/** Liest den Körper, bricht aber ab, sobald er größer als `maxBytes` wird. */
async function readLimited(res: Response, url: string, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get('content-length'));
  if (declared > maxBytes) {
    await res.body?.cancel();
    throw new BlockedFetchError(`Antwort zu groß (${declared} Bytes): ${url}`);
  }
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BlockedFetchError(`Antwort zu groß (über ${maxBytes} Bytes): ${url}`);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export type GetOptions = {
  fetch?: FetchLike;
  lookup?: LookupLike;
  timeoutMs?: number;
  accept?: string;
  maxBytes?: number;
};

export async function getText(url: string, options: GetOptions = {}): Promise<string> {
  const doFetch = options.fetch ?? fetch;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  let current = url;
  for (let hop = 0; ; hop++) {
    await assertPublicUrl(current, options.lookup);
    // Weiterleitungen selbst verfolgen, damit auch ihr Ziel geprüft wird.
    const res = await doFetch(current, {
      headers: { 'user-agent': USER_AGENT, accept: options.accept ?? '*/*' },
      signal,
      redirect: 'manual',
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      if (hop >= MAX_REDIRECTS) throw new BlockedFetchError(`Zu viele Weiterleitungen: ${url}`);
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new HttpError(current, res.status);
    }
    return readLimited(res, current, options.maxBytes ?? MAX_RESPONSE_BYTES);
  }
}

export async function getJson<T>(url: string, options: GetOptions = {}): Promise<T> {
  const text = await getText(url, { ...options, accept: 'application/json' });
  return JSON.parse(text) as T;
}
