import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import de from '../locales/de.json';
import { createTranslator, flattenMessages } from '../src/index.ts';

const messages = flattenMessages(de);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.ts$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
  });
}

describe('i18n', () => {
  const t = createTranslator(messages, 'de');

  it('setzt Parameter ein', () => {
    expect(t.t('pager.pageOf', { page: 2, total: 5 })).toBe('Seite 2 von 5');
  });

  it('wählt Pluralformen', () => {
    expect(t.tp('card.readingTime', 1)).toBe('ca. 1 Minute');
    expect(t.tp('card.readingTime', 4)).toBe('ca. 4 Minuten');
  });

  it('Anrede: jede Sie-Fassung hat eine Du-Fassung (SPEC §8.7)', () => {
    const sie = Object.keys(messages).filter((k) => k.endsWith('.sie'));
    expect(sie.length).toBeGreaterThan(5);
    for (const k of sie) expect(k.replace(/\.sie$/, '.du') in messages, k).toBe(true);
    const du = createTranslator(messages, 'de', 'du');
    expect(du.t('settings.font.hint')).toMatch(/^Tippe/);
    expect(t.t('settings.font.hint')).toMatch(/^Tippen Sie/);
    // Texte ohne Anrede gelten für beide.
    expect(du.t('nav.settings')).toBe('Einstellungen');
  });

  it('meldet fehlende Schlüssel', () => {
    expect(() => t.t('gibt.es.nicht')).toThrow();
  });

  it('jeder in Web-App und Erweiterung benutzte Schlüssel steht in de.json', () => {
    const roots = ['../../web/src', '../../extension/src'].map((d) =>
      path.resolve(import.meta.dirname, d),
    );
    const used = new Set<string>();
    for (const file of roots.flatMap(sources)) {
      const code = readFileSync(file, 'utf8');
      for (const m of code.matchAll(/\bt[p]?\('([\w.]+)'/g)) if (m[1]) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(5);
    for (const key of used) {
      const exists = key in messages || `${key}.other` in messages || `${key}.sie` in messages;
      expect(exists, key).toBe(true);
    }
  });
});
