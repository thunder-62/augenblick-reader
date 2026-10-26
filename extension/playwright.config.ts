import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-Tests von Augenblick für Firefox (ADR 024): die echten Testseiten mit dem echten
 * Inhaltsskript, die Leseansicht unter einer zweiten Herkunft. Tablet im Querformat wie die Web-App.
 */
const PAGE_PORT = 8141;
const EXT_PORT = 8142;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PAGE_PORT}`,
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
    command: 'node e2e/server.mjs',
    url: `http://127.0.0.1:${PAGE_PORT}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PAGE_PORT: String(PAGE_PORT), EXT_PORT: String(EXT_PORT) },
  },
});
