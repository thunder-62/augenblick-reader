import { defineConfig, type Plugin } from 'vite';

const api = `http://127.0.0.1:${process.env.PORT ?? 8080}`;

/** In der Entwicklung /admin und /admin/… auf admin.html umleiten (im Betrieb macht das der Server). */
const adminRoute: Plugin = {
  name: 'augenblick-admin-route',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/admin(\/[^.]*)?(\?.*)?$/.test(req.url)) req.url = '/admin.html';
      next();
    });
  },
};

export default defineConfig({
  plugins: [adminRoute],
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
      input: { main: 'index.html', admin: 'admin.html' },
    },
  },
});
