// Bündelt API und Worker zu je einer Datei; Laufzeit-Abhängigkeiten bleiben extern (npm ci --omit=dev).
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = process.env.AUGENBLICK_VERSION ?? root.version;

await build({
  entryPoints: ['src/api.ts', 'src/worker.ts', 'src/seed-demo.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: Object.keys(pkg.dependencies ?? {}),
  define: { __AUGENBLICK_VERSION__: JSON.stringify(version) },
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});
