import './styles.css';
import { App, type Preview } from './app.ts';

// Kein Kontextmenü bei langem Druck, keine Textauswahl, kein Zoom per Geste (SPEC §8.1).
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);

// Querformat sperren, soweit der Browser es erlaubt (im Vollbild-PWA-Modus); sonst regelt es das Manifest.
const orientation = screen.orientation as ScreenOrientation & {
  lock?: (o: string) => Promise<void>;
};
orientation.lock?.('landscape').catch(() => undefined);

/** Vorschau aus dem Admin-Bereich: `/?vorschau=<Einstellungen als JSON>&artikel=<id>`. */
function readPreview(): Preview | null {
  const params = new URLSearchParams(location.search);
  if (!params.has('vorschau')) return null;
  let settings: unknown;
  try {
    settings = JSON.parse(params.get('vorschau') || '{}');
  } catch {
    settings = {};
  }
  const articleId = params.get('artikel') ?? undefined;
  return articleId ? { settings, articleId } : { settings };
}

const root = document.getElementById('app');
if (root) void new App(root, readPreview()).start();
