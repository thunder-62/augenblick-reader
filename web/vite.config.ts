import { defineConfig } from 'vite';

const api = `http://127.0.0.1:${process.env.PORT ?? 8080}`;

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': api, '/health': api },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
