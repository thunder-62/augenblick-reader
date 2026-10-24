import cron from 'node-cron';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SECTIONS, MIN_FONT_SIZE_PX } from '@augenblick/shared';
import { loadConfig, parseSections } from '../src/core/config.ts';
import { FETCH_SCHEDULES } from '../src/core/schedule.ts';

describe('Konfiguration', () => {
  it('liest den Rubriken-Mix', () => {
    expect(parseSections(undefined)).toEqual(DEFAULT_SECTIONS);
    expect(parseSections('region=region:6; welt=inland,ausland:6')).toEqual([
      { key: 'region', sections: ['region'], count: 6 },
      { key: 'welt', sections: ['inland', 'ausland'], count: 6 },
    ]);
    expect(() => parseSections('kaputt')).toThrow();
  });

  it('setzt Standardwerte und Grenzen', () => {
    const c = loadConfig({
      AUGENBLICK_FONT_SIZE_PX: '10',
      AUGENBLICK_THEME: 'light',
      TAGESSCHAU_HOURLY_LIMIT: '500',
    });
    expect(c.settings.fontSizePx).toBe(MIN_FONT_SIZE_PX);
    expect(c.settings.theme).toBe('light');
    expect(c.tagesschauHourlyLimit).toBeLessThan(60);
    expect(c.rssFeeds).toEqual(['br24-mittelfranken']);
    expect(loadConfig({ BR24_FEED_URL: 'https://example.org/alt.xml' }).rssFeeds).toEqual([
      'https://example.org/alt.xml',
    ]);
    expect(
      loadConfig({ AUGENBLICK_RSS_FEEDS: 'br24-mittelfranken, https://example.org/b.xml' })
        .rssFeeds,
    ).toEqual(['br24-mittelfranken', 'https://example.org/b.xml']);
  });

  it('Zeitplan: alle 30 Minuten von 5:00 bis 22:00', () => {
    for (const expr of FETCH_SCHEDULES) expect(cron.validate(expr)).toBe(true);
    expect(FETCH_SCHEDULES).toEqual(['0,30 5-21 * * *', '0 22 * * *']);
  });
});
