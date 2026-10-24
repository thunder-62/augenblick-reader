import { describe, expect, it } from 'vitest';
import { mm } from '@augenblick/shared';
import { isTap } from './tap.ts';

const base = { downAt: 1000, upAt: 1150, dx: 0, dy: 0, lastTapAt: null, inside: true };

describe('isTap (SPEC §8.1)', () => {
  it('normaler Tipp löst aus', () => expect(isTap(base)).toBe(true));
  it('Berührung unter 80 ms wird ignoriert', () =>
    expect(isTap({ ...base, upAt: 1079 })).toBe(false));
  it('genau 80 ms zählen', () => expect(isTap({ ...base, upAt: 1080 })).toBe(true));
  it('zweiter Tipp innerhalb von 300 ms wird ignoriert', () =>
    expect(isTap({ ...base, lastTapAt: 800 })).toBe(false));
  it('nach 300 ms zählt ein Tipp wieder', () =>
    expect(isTap({ ...base, lastTapAt: 700 })).toBe(true));
  it('mehr als 10 mm Bewegung ist kein Tipp', () =>
    expect(isTap({ ...base, dx: mm(10) + 1 })).toBe(false));
  it('kleine Bewegung bleibt ein Tipp', () =>
    expect(isTap({ ...base, dx: mm(3), dy: mm(3) })).toBe(true));
  it('Loslassen außerhalb des Ziels löst nicht aus', () =>
    expect(isTap({ ...base, inside: false })).toBe(false));
  it('lange Berührung löst beim Loslassen trotzdem aus (kein Long-Press-Modus)', () =>
    expect(isTap({ ...base, upAt: 3000 })).toBe(true));
});
