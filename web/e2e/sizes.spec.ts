/**
 * Alle Stufen der Kalibrierung (Auftrag 004, A1): Übersicht, Artikel, Einstellungen und Einführung
 * erfüllen bei jeder Schriftgröße die Prüfungen aus SPEC §14, und ein echter Tipp auf die erste
 * Karte öffnet den Artikel.
 */
import { expect, test, type Page } from '@playwright/test';
import { CALIBRATION_SIZES_PX } from '@augenblick/shared';
import { checkScreen, pageInfo, resetState, tap, withSettings } from './helpers.ts';

test.beforeEach(async ({ request }) => {
  await resetState(request);
});

async function menu(page: Page, label: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const item = page.locator('.menu-item', { hasText: label });
    if (await item.count()) return tap(item);
    await checkScreen(page);
    await tap(page.locator('.btn-next'));
  }
  throw new Error(`Menüpunkt „${label}“ nicht gefunden`);
}

for (const fontSizePx of CALIBRATION_SIZES_PX) {
  test.describe(`${fontSizePx} px`, () => {
    test.beforeEach(async ({ page }) => {
      await withSettings(page, { fontSizePx });
    });

    test('Übersicht und Artikel', async ({ page }) => {
      await page.goto('/');
      const first = page.locator('.card').first();
      await expect(first).toBeVisible();
      await checkScreen(page);
      // Der Titel steht immer ganz auf der Karte.
      const title = (await first.locator('.title').textContent()) ?? '';
      expect(title.length).toBeGreaterThan(0);

      const { total } = await pageInfo(page);
      if (total > 1) {
        await tap(page.locator('.btn-next'));
        // Lang- oder Kurzform zeigen dieselbe, aktuelle Seite.
        expect((await pageInfo(page)).page).toBe(2);
        await expect(page.locator('.pageinfo')).toContainText('2');
        await checkScreen(page);
        await tap(page.locator('.btn-back'));
      }

      // Echter Tipp (Maus drücken/loslassen über der Mitte der Karte), keine Leiste dazwischen.
      const box = (await page.locator('.card').first().boundingBox())!;
      const hit = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x!, y!)?.closest('.card') !== null,
        [box.x + box.width / 2, box.y + box.height / 2],
      );
      expect(hit, 'Mitte der ersten Karte trifft die Karte').toBe(true);
      await tap(page.locator('.card').first());
      await expect(page.locator('.prose h1')).toHaveText(title);
      await checkScreen(page);
      // Fließtext (ADR 018): weiter wischen, der runde Knopf bleibt erreichbar.
      await page.locator('.article-scroll').evaluate((el) => el.scrollBy(0, el.clientHeight));
      await checkScreen(page);
      await tap(page.locator('.btn-overview'));
      await expect(page.locator('.card').first()).toBeVisible();
    });

    test('Einstellungen', async ({ page }) => {
      await page.goto('/');
      await tap(page.locator('.btn-settings'));
      await expect(page.locator('.flowtitle')).toHaveText('Einstellungen');
      await checkScreen(page);
      await menu(page, 'Schrift einstellen');
      await checkScreen(page);
      await tap(page.getByRole('button', { name: 'Das ist angenehm' }));
      await expect(page.locator('.flowtitle')).toHaveText('Soll das ab jetzt immer so bleiben?');
      await checkScreen(page);
      await tap(page.locator('.btn-no'));
      for (const label of ['Farben', 'Zeilenabstand', 'Was ich gern lese', 'Wie am Anfang']) {
        await menu(page, label);
        await checkScreen(page);
        await tap(page.locator('.btn-overview'));
        await tap(page.locator('.btn-settings'));
      }
    });

    test('Einführung', async ({ page, request }) => {
      await request.put('/api/intro', { data: { state: 'neu', step: 1 } });
      await page.goto('/');
      await expect(page.locator('.flowtitle')).toHaveText('Willkommen bei Augenblick');
      for (let step = 1; step <= 6; step++) {
        await expect(page.locator('.meta')).toHaveText(`Schritt ${step} von 6`);
        await checkScreen(page);
        if (step === 6) break;
        await tap(page.locator('.btn-skip'));
      }
    });
  });
}
