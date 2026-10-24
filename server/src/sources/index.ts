import type { Config } from '../core/config.ts';
import { Br24Adapter } from './br24.ts';
import { TagesschauAdapter } from './tagesschau.ts';
import type { SourceAdapter } from './types.ts';

export function createAdapters(config: Config): SourceAdapter[] {
  return [
    new TagesschauAdapter({
      baseUrl: config.tagesschauBaseUrl,
      hourlyLimit: config.tagesschauHourlyLimit,
    }),
    new Br24Adapter({ feedUrl: config.br24FeedUrl }),
  ];
}
