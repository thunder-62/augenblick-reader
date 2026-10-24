import './styles.css';
import { App } from './app.ts';

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

const root = document.getElementById('app');
if (root) void new App(root).start();
