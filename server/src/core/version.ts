declare const __AUGENBLICK_VERSION__: string | undefined;

/** Wird beim Bauen gesetzt (server/build.mjs), in der Entwicklung „dev“. */
export const VERSION: string =
  typeof __AUGENBLICK_VERSION__ === 'string' ? __AUGENBLICK_VERSION__ : 'dev';
