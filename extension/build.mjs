// Baut Augenblick für Firefox nach dist/ (SPEC §16.9): Inhaltsskript und Hintergrund als je eine
// Datei, die Leseansicht als Seite mit Styles, dazu Schrift, Symbol und das Manifest.
// Namen und Beschreibung kommen aus shared/locales/de.json (Abschnitt „extension“).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const here = (p) => new URL(p, import.meta.url);
const pkg = JSON.parse(readFileSync(here('./package.json'), 'utf8'));
const de = JSON.parse(readFileSync(here('../shared/locales/de.json'), 'utf8'));
const dist = here('./dist/');

/** Auf diesen Seiten läuft das Inhaltsskript (für die Taste nötig, SPEC §16.7). */
const PAGES = ['http://*/*', 'https://*/*'];

export const manifest = {
  manifest_version: 3,
  name: de.extension.name,
  short_name: de.app.name,
  version: pkg.version,
  description: de.extension.description,
  homepage_url: 'https://github.com/thunder-62/augenblick-reader',
  icons: { 48: 'icon.svg', 96: 'icon.svg', 128: 'icon.svg' },
  browser_specific_settings: {
    gecko: {
      id: 'augenblick@thunder-62.github.io',
      strict_min_version: '142.0',
      data_collection_permissions: { required: ['none'] },
    },
    gecko_android: { strict_min_version: '142.0' },
  },
  // Keine weiteren Berechtigungen (SPEC §16.7); `storage` kommt erst mit den Einstellungen (F2).
  permissions: [],
  content_scripts: [{ matches: PAGES, js: ['content.js'], run_at: 'document_idle' }],
  background: { scripts: ['background.js'] },
  // `action` statt `page_action` (Fehler in Firefox für Android ab Version 142).
  action: { default_title: de.extension.action, default_icon: 'icon.svg' },
  web_accessible_resources: [
    { resources: ['reader.html', 'reader.js', 'reader.css', 'fonts/*'], matches: PAGES },
  ],
};

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const common = {
  bundle: true,
  target: 'firefox142',
  legalComments: 'none',
  logLevel: 'warning',
  // Die Schrift liegt als Datei neben der Leseansicht.
  external: ['/fonts/*'],
};
await build({
  ...common,
  entryPoints: ['src/content.ts', 'src/background.ts'],
  outdir: 'dist',
  format: 'iife',
});
await build({ ...common, entryPoints: ['src/reader.ts'], outdir: 'dist', format: 'esm' });

cpSync(here('./src/reader.html'), here('./dist/reader.html'));
cpSync(here('../web/public/fonts'), here('./dist/fonts'), { recursive: true });
cpSync(here('../web/public/icon.svg'), here('./dist/icon.svg'));
writeFileSync(here('./dist/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Augenblick für Firefox ${pkg.version} → extension/dist`);
