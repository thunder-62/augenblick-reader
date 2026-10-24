import { defineConfig, type Plugin } from 'vite';

const api = `http://127.0.0.1:${process.env.PORT ?? 8080}`;

/** In der Entwicklung /technik und /technik/… auf technik.html umleiten (im Betrieb macht das der Server). */
const technikRoute: Plugin = {
  name: 'augenblick-technik-route',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/technik(\/[^.]*)?(\?.*)?$/.test(req.url)) req.url = '/technik.html';
      next();
    });
  },
};

export default defineConfig({
  plugins: [technikRoute],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': api, '/health': api },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: { main: 'index.html', technik: 'technik.html' },
    },
  },
});
