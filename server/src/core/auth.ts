/**
 * Zugang zum Admin-Bereich (SPEC §9): nur aus erlaubten Netzen (Standard: dieses Gerät und Tailscale)
 * und zusätzlich mit PIN. Nach der Anmeldung hält ein signiertes Cookie die Sitzung.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { BlockList, isIPv4, isIPv6 } from 'node:net';
import type { Db } from './db.ts';
import { getConfig, setConfig } from './store.ts';

/** Loopback und die Adressbereiche von Tailscale (100.64.0.0/10, fd7a:115c:a1e0::/48). */
export const DEFAULT_ADMIN_NETWORKS = [
  '127.0.0.0/8',
  '::1/128',
  '100.64.0.0/10',
  'fd7a:115c:a1e0::/48',
];

export const SESSION_COOKIE = 'augenblick_admin';
export const SESSION_DAYS = 30;

export function parseNetworks(list: string[]): BlockList {
  const bl = new BlockList();
  for (const raw of list) {
    const entry = raw.trim();
    if (!entry) continue;
    const [addr = '', bits] = entry.split('/');
    const type = isIPv4(addr) ? 'ipv4' : isIPv6(addr) ? 'ipv6' : null;
    if (!type) throw new Error(`Ungültiges Netz in AUGENBLICK_ADMIN_NETWORKS: ${entry}`);
    const prefix = bits === undefined ? (type === 'ipv4' ? 32 : 128) : Number(bits);
    bl.addSubnet(addr, prefix, type);
  }
  return bl;
}

export function isAllowedAddress(bl: BlockList, address: string | undefined): boolean {
  if (!address) return false;
  const a = address.startsWith('::ffff:') && isIPv4(address.slice(7)) ? address.slice(7) : address;
  if (isIPv4(a)) return bl.check(a, 'ipv4');
  if (isIPv6(a)) return bl.check(a, 'ipv6');
  return false;
}

const digest = (s: string): Buffer => createHash('sha256').update(s).digest();

export function pinMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string') return false;
  return timingSafeEqual(digest(expected), digest(given.trim()));
}

/** Nach 5 falschen PINs innerhalb von 15 Minuten ist die Anmeldung 15 Minuten gesperrt. */
export class LoginThrottle {
  private fails: number[] = [];
  private lockedUntil = 0;

  constructor(
    private readonly maxFails = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  locked(): boolean {
    return this.now() < this.lockedUntil;
  }

  fail(): void {
    const t = this.now();
    this.fails = this.fails.filter((f) => t - f < this.windowMs);
    this.fails.push(t);
    if (this.fails.length >= this.maxFails) {
      this.lockedUntil = t + this.windowMs;
      this.fails = [];
    }
  }

  success(): void {
    this.fails = [];
  }
}

export function sessionSecret(db: Db): string {
  let secret = getConfig(db, 'session_secret');
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    setConfig(db, 'session_secret', secret);
  }
  return secret;
}

const sign = (secret: string, payload: string): string =>
  createHmac('sha256', secret).update(payload).digest('hex');

export function createSessionToken(secret: string, now: number, days = SESSION_DAYS): string {
  const exp = String(now + days * 24 * 60 * 60 * 1000);
  return `${exp}.${sign(secret, exp)}`;
}

export function verifySessionToken(
  secret: string,
  token: string | undefined,
  now: number,
): boolean {
  if (!token) return false;
  const [exp, mac] = token.split('.');
  if (!exp || !mac || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  const expected = Buffer.from(sign(secret, exp), 'hex');
  const given = Buffer.from(mac, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function sessionCookie(
  token: string,
  secure: boolean,
  maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60,
): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}
