// Testserver für die E2E-Tests der Erweiterung (ADR 024). Playwright kann Erweiterungen in
// Firefox nicht laden, deshalb:
// - Port PAGE_PORT liefert die selbst geschriebenen Testseiten aus und hängt das echte
//   Inhaltsskript an, dazu eine kleine Nachbildung der WebExtension-Schnittstelle (stub.js).
// - Port EXT_PORT liefert extension/dist aus – unter einer anderen Herkunft, wie moz-extension://.
// - /bilder/<name>.png erzeugt einfarbige Testbilder (keine fremden Bilder im Repo).
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const here = path.dirname(new URL(import.meta.url).pathname);
const dist = path.resolve(here, '../dist');
const pages = path.resolve(here, '../test/pages');
const PAGE_PORT = Number(process.env.PAGE_PORT ?? 8141);
const EXT_PORT = Number(process.env.EXT_PORT ?? 8142);
const EXT_ORIGIN = `http://localhost:${EXT_PORT}`;

execFileSync(process.execPath, ['build.mjs'], { cwd: path.resolve(here, '..'), stdio: 'inherit' });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

/** Größen der Testbilder (Breite × Höhe). */
const IMAGES = { marktplatz: [1200, 675], entwurf: [1200, 800], zaehlpixel: [1, 1] };

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function png(w, h, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(w).fill(rgb).flat())]);
  const raw = Buffer.concat(Array(h).fill(row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const STUB = `
(() => {
  const listeners = [];
  window.browser = {
    runtime: {
      getURL: (p) => ${JSON.stringify(EXT_ORIGIN)} + '/' + p,
      onMessage: { addListener: (cb) => listeners.push(cb) },
    },
  };
  // Ersatzweg über das Firefox-Menü (background.ts) nachgebildet.
  window.__augenblickMenu = () => listeners.forEach((cb) => cb({ type: 'augenblick:open' }, { id: 'test' }));
})();
`;

function sendFile(res, file) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('nicht gefunden');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'cache-control': 'max-age=3600',
  });
  createReadStream(file).pipe(res);
}

const inside = (root, p) => {
  const file = path.resolve(root, `.${p}`);
  return file.startsWith(root + path.sep) ? file : null;
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PAGE_PORT}`);
  if (url.pathname === '/health') return res.writeHead(200).end('ok');
  if (url.pathname === '/__ext/stub.js') {
    res.writeHead(200, { 'content-type': TYPES['.js'] });
    return res.end(STUB);
  }
  if (url.pathname === '/__ext/content.js') return sendFile(res, path.join(dist, 'content.js'));
  const img = /^\/bilder\/(\w+)\.png$/.exec(url.pathname);
  if (img && IMAGES[img[1]]) {
    const [w, h] = IMAGES[img[1]];
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=3600' });
    return res.end(png(w, h, [90, 110, 130]));
  }
  const file = inside(pages, url.pathname);
  if (!file) return res.writeHead(404).end();
  if (file.endsWith('.html') && existsSync(file)) {
    // Wie Firefox: das Inhaltsskript läuft, wenn die Seite geladen ist (document_idle).
    const html = readFileSync(file, 'utf8').replace(
      '</body>',
      '<script src="/__ext/stub.js"></script><script src="/__ext/content.js" defer></script></body>',
    );
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    return res.end(html);
  }
  return sendFile(res, file);
}).listen(PAGE_PORT, '127.0.0.1');

createServer((req, res) => {
  const url = new URL(req.url ?? '/', EXT_ORIGIN);
  const file = inside(dist, url.pathname);
  if (!file) return res.writeHead(404).end();
  return sendFile(res, file);
}).listen(EXT_PORT, '127.0.0.1');

console.log(`Testseiten: http://127.0.0.1:${PAGE_PORT}/  Erweiterung: ${EXT_ORIGIN}/`);
