/**
 * Schutz gegen DNS-Rebinding und CSRF (Auftrag 004, D16; ADR 013).
 *
 * Eine fremde Webseite kann ihren Namen kurzzeitig auf die Adresse des Pi zeigen lassen und dann
 * „im eigenen Namen“ Anfragen an Augenblick schicken. Dagegen hilft die Prüfung des Host-Headers:
 * erlaubt sind nur die eigenen IP-Adressen, der eigene Hostname, `localhost` und Namen aus
 * `AUGENBLICK_ALLOWED_HOSTS` (z. B. der Tailscale-Name; mit führendem Punkt als Endung).
 */
import { hostname as osHostname, networkInterfaces } from 'node:os';
import { isIP } from 'node:net';

/** Hostname ohne Port, klein, ohne Klammern um IPv6 und ohne Punkt am Ende. */
export function hostOf(header: string | undefined): string | null {
  if (!header) return null;
  const h = header.trim().toLowerCase();
  const v6 = /^\[([^\]]+)\](?::\d+)?$/.exec(h);
  if (v6) return v6[1] ?? null;
  const m = /^([^:]+)(?::\d+)?$/.exec(h);
  return m?.[1]?.replace(/\.$/, '') ?? null;
}

function ownAddresses(): Set<string> {
  const out = new Set<string>(['127.0.0.1', '::1']);
  for (const list of Object.values(networkInterfaces()))
    for (const a of list ?? []) out.add(a.address.toLowerCase().replace(/%.*$/, ''));
  return out;
}

export type HostCheck = (header: string | undefined) => boolean;

export function hostChecker(
  allowed: readonly string[],
  opts: { hostname?: string; addresses?: () => Set<string>; refreshMs?: number } = {},
): HostCheck {
  const name = (opts.hostname ?? osHostname()).toLowerCase();
  const names = new Set(['localhost', name, `${name}.local`]);
  const suffixes: string[] = [];
  for (const raw of allowed) {
    const entry = raw.trim().toLowerCase().replace(/\.$/, '');
    if (!entry) continue;
    if (entry.startsWith('.')) suffixes.push(entry);
    else names.add(entry);
  }
  // Adressen ändern sich selten (DHCP, Tailscale): kurz zwischenspeichern.
  const lookup = opts.addresses ?? ownAddresses;
  const refreshMs = opts.refreshMs ?? 30_000;
  let cached = lookup();
  let at = Date.now();
  return (header) => {
    const host = hostOf(header);
    if (!host) return false;
    if (isIP(host)) {
      if (Date.now() - at > refreshMs) {
        cached = lookup();
        at = Date.now();
      }
      return cached.has(host.replace(/^::ffff:/, '')) || cached.has(host);
    }
    if (names.has(host) || host.endsWith('.localhost')) return true;
    return suffixes.some((s) => host.endsWith(s) && host.length > s.length);
  };
}
