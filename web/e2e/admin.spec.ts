import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_SETTINGS } from '@augenblick/shared';
import { checkScreen, tap } from './helpers.ts';

const PIN = '4711';

/** Anmelden über die API (setzt das Sitzungs-Cookie im Browser-Kontext), dann den Admin-Bereich öffnen. */
async function login(page: Page): Promise<void> {
  const res = await page.request.post('/api/admin/login', { data: { pin: PIN } });
  expect(res.ok()).toBe(true);
  await page.goto('/admin');
  await expect(page.locator('.tabs')).toBeVisible();
}

/** Einstellungen nach jedem Test zurücksetzen – die Lese-Tests erwarten die Standardwerte. */
test.afterEach(async ({ page }) => {
  await login(page);
  const res = await page.request.put('/api/admin/settings', { data: DEFAULT_SETTINGS });
  expect(res.ok()).toBe(true);
});

test('Anmeldung: falsche PIN abgewiesen, richtige PIN zeigt den Status', async ({ page }) => {
  await page.goto('/admin');
  await page.fill('input[name=pin]', '0000');
  await page.click('button[type=submit]');
  await expect(page.locator('.statusline.error')).toContainText('PIN stimmt nicht');
  await page.fill('input[name=pin]', PIN);
  await page.click('button[type=submit]');
  await expect(page.locator('.facts').first()).toContainText('Version');
  await expect(page.locator('.facts').first()).toContainText('8 Artikel');
  // Ohne API-Schlüssel: KI aus, Kurzfassungen sind die ersten Sätze.
  await expect(page.locator('body')).toContainText('kein API-Schlüssel');
});

test('ohne Anmeldung liefert die Admin-API nichts', async ({ request }) => {
  expect((await request.get('/api/admin/status')).status()).toBe(401);
  expect((await request.put('/api/admin/settings', { data: { theme: 'light' } })).status()).toBe(
    401,
  );
});

test('Einstellungen speichern wirkt in der Lese-App', async ({ page, context }) => {
  await login(page);
  await page.click('text=Einstellungen');
  await page.fill('input[name=fontSizePx]', '36');
  await page.selectOption('select[name=theme]', 'light');
  // Live-Vorschau übernimmt die Werte schon vor dem Speichern.
  const preview = page.frameLocator('.preview-box iframe');
  await expect(preview.locator('body')).toHaveCSS('background-color', 'rgb(250, 247, 240)');
  await page.click('button:has-text("Speichern")');
  await expect(page.locator('.statusline.ok')).toBeVisible();

  const reader = await context.newPage();
  await reader.goto('/');
  await expect(reader.locator('.card').first()).toBeVisible();
  await expect(reader.locator('body')).toHaveCSS('font-size', '36px');
  await expect(reader.locator('body')).toHaveCSS('background-color', 'rgb(250, 247, 240)');
  await checkScreen(reader);
});

test('Kalibrierung: Größe und Schema wählen, Vorschau, speichern – wirkt auf dem Tablet', async ({
  page,
  context,
}) => {
  await login(page);
  await page.click('text=Kalibrierung');
  await page.click('text=Kalibrierung starten');
  await expect(page.locator('.calib-info')).toContainText('24 px');
  await page.click('text=Größer ▸');
  await expect(page.locator('.calib-info')).toContainText('30 px');
  await page.click('text=✓ Angenehm');
  await page.click('text=Hell zeigen');
  await expect(page.locator('.calib-stage')).toHaveCSS('background-color', 'rgb(250, 247, 240)');
  await page.click('text=Lesezeit messen');
  await page.click('text=Fertig gelesen');
  await expect(page.locator('.calib-bar')).toContainText(/Hell zeigen \(\d+ s\)/);
  await page.click('text=✓ Dunkel nehmen');
  await expect(page.frameLocator('.calib-frame').locator('.prose h1')).toBeVisible();
  await page.click('text=✓ Speichern');
  await expect(page.locator('.calib-bar')).toContainText('Gespeichert');

  const settings = await (await page.request.get('/api/settings')).json();
  expect(settings).toMatchObject({ fontSizePx: 30, theme: 'dark' });

  const reader = await context.newPage();
  await reader.goto('/');
  await expect(reader.locator('body')).toHaveCSS('font-size', '30px');
  await page.click('text=Schließen');
  await expect(page.locator('.panel')).toContainText('Zuletzt kalibriert');
});

test('Vorschau speichert keinen Lesezustand', async ({ page }) => {
  await page.goto(`/?vorschau=${encodeURIComponent('{"theme":"light"}')}&artikel=demo-markt`);
  await expect(page.locator('.prose h1')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 247, 240)');
  expect(await page.evaluate(() => localStorage.getItem('augenblick.v1.state'))).toBeNull();
});

test('Quellen: Feed-Adresse und Rubriken-Mix', async ({ page }) => {
  await login(page);
  await page.click('text=Quellen und Rubriken');
  await page.fill('input[name=br24FeedUrl]', 'keine adresse');
  await page.locator('form').first().locator('button[type=submit]').click();
  // Der Browser lässt eine ungültige URL gar nicht erst durch.
  await expect(page.locator('.statusline.ok')).toHaveCount(0);
  await expect(page.locator('table.mix tbody tr')).toHaveCount(DEFAULT_SETTINGS.sections.length);
  await expect(page.locator('form').nth(1)).toContainText('Summe: 12 von 12');
});

test('Nutzungsprotokoll: Lesen wird gezählt', async ({ page, context }) => {
  const reader = await context.newPage();
  await reader.goto('/');
  await tap(reader.locator('.card').first());
  await reader.waitForTimeout(3500);
  await tap(reader.locator('.btn-next'));
  await tap(reader.locator('.btn-overview'));
  await expect(reader.locator('.card').first()).toBeVisible();

  await login(page);
  await page.click('text=Nutzung');
  await expect(page.locator('table tbody tr').first()).toContainText(/\d/);
  const usage = await (await page.request.get('/api/admin/usage')).json();
  expect(usage.days[0].articles).toBeGreaterThanOrEqual(1);
  expect(usage.days[0].pages).toBeGreaterThanOrEqual(2);
});

test('Spickzettel zum Drucken', async ({ page }) => {
  await login(page);
  await page.click('text=Spickzettel');
  await expect(page.locator('.sheet h1')).toHaveText('So lesen Sie Ihre Zeitung');
  await expect(page.locator('.sheet li')).toHaveCount(4);
});
