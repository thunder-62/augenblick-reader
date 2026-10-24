// Baut das Release-Paket (SPEC §9): gebaute Web-App + Server, ohne node_modules.
// Aufruf nach `npm run build`: `npm run package` → release/augenblick-<version>.tar.gz (+ .sha256)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
const version = (process.env.AUGENBLICK_VERSION ?? tag ?? pkg.version).replace(/^v/, '');
if (!/^[0-9A-Za-z.+-]+$/.test(version)) throw new Error(`Ungültige Version: ${version}`);

for (const p of ['web/dist/index.html', 'server/dist/api.js', 'server/dist/worker.js']) {
  if (!existsSync(path.join(root, p)))
    throw new Error(`${p} fehlt – vorher \`npm run build\` ausführen.`);
}

const name = `augenblick-${version}`;
const outDir = path.join(root, 'release');
const stage = path.join(outDir, name);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const files = [
  'package.json',
  'package-lock.json',
  'LICENSE',
  'README.md',
  '.env.example',
  'shared/package.json',
  'web/package.json',
  'server/package.json',
];
for (const f of files) cpSync(path.join(root, f), path.join(stage, f));
for (const d of ['server/dist', 'web/dist', 'deploy'])
  cpSync(path.join(root, d), path.join(stage, d), { recursive: true });
writeFileSync(path.join(stage, 'VERSION'), `${version}\n`);

const tarball = path.join(outDir, `${name}.tar.gz`);
execFileSync('tar', ['-czf', tarball, '-C', outDir, name], { stdio: 'inherit' });
const sum = createHash('sha256').update(readFileSync(tarball)).digest('hex');
writeFileSync(`${tarball}.sha256`, `${sum}  ${name}.tar.gz\n`);
rmSync(stage, { recursive: true, force: true });
console.log(`Release-Paket: ${path.relative(root, tarball)} (${sum})`);
