import type { Config } from '../core/config.ts';
import { Br24Adapter } from './br24.ts';
import { TagesschauAdapter } from './tagesschau.ts';
import type { SourceAdapter } from './types.ts';

/** Die Adapter leben so lange wie der Worker (Ratenbegrenzung); die BR24-Adresse wird je Lauf gelesen. */
export function createAdapters(
  config: Config,
  br24FeedUrl: () => string = () => config.br24FeedUrl,
): SourceAdapter[] {
  return [
    new TagesschauAdapter({
      baseUrl: config.tagesschauBaseUrl,
      hourlyLimit: config.tagesschauHourlyLimit,
    }),
    new Br24Adapter({ feedUrl: br24FeedUrl }),
  ];
}
