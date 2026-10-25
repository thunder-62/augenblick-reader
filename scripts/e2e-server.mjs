// Startet für die E2E-Tests: Web-App bauen, frische Datenbank mit selbst geschriebenen Beispieltexten, API.
import { execFileSync, execSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve('test-results/e2e-data');
rmSync(dataDir, { recursive: true, force: true });
const env = {
  ...process.env,
  AUGENBLICK_DATA_DIR: dataDir,
  AUGENBLICK_WEB_DIST: path.resolve('web/dist'),
  HOST: '127.0.0.1',
};
execSync('npm run build -w web', { stdio: 'inherit', env });
// tsx direkt über Node laden statt über npx – funktioniert so auch unter Windows (npx ist dort eine .cmd-Datei).
const tsx = (script) => [process.execPath, ['--import', 'tsx', script]];
execFileSync(...tsx('server/src/seed-demo.ts'), { stdio: 'inherit', env });
const api = spawn(...tsx('server/src/api.ts'), { stdio: 'inherit', env });
const stop = () => api.kill('SIGTERM');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
api.on('exit', (code) => process.exit(code ?? 0));
