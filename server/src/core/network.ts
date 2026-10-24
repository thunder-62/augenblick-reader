/**
 * Technik-Bereich (SPEC §9/§10): ohne PIN, aber nur aus dem Heimnetz bzw. über Tailscale.
 * Er ist auf dem Tablet nicht verlinkt, weil er nur Technik enthält – nicht, weil er versperrt wäre.
 * Die Netzprüfung verhindert nur, dass er versehentlich aus dem Internet erreichbar wird.
 */
import { BlockList, isIPv4, isIPv6 } from 'node:net';

/** Dieses Gerät, private Heimnetze, Tailscale und lokale IPv6-Adressen. */
export const DEFAULT_TECHNIK_NETWORKS = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
  '100.64.0.0/10',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
];

export function parseNetworks(list: string[]): BlockList {
  const bl = new BlockList();
  for (const raw of list) {
    const entry = raw.trim();
    if (!entry) continue;
    const [addr = '', bits] = entry.split('/');
    const type = isIPv4(addr) ? 'ipv4' : isIPv6(addr) ? 'ipv6' : null;
    if (!type) throw new Error(`Ungültiges Netz in AUGENBLICK_TECHNIK_NETWORKS: ${entry}`);
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
