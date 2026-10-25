import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-Tests im Querformat-Tablet-Viewport 1280×800 CSS-px. Die Schriftgröße stellt die Leserin in der
 * Einführung selbst ein; eine Messung am Gerät ist laut Betreuer nicht nötig.
 */
const PORT = 8137;

export default defineConfig({
  testDir: 'web/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    hasTouch: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(PORT) },
  },
});
