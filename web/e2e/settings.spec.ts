import { expect, test, type Page } from '@playwright/test';
import { CALIBRATION_SIZES_PX, DEFAULT_SETTINGS } from '@augenblick/shared';
import { checkScreen, resetState, tap } from './helpers.ts';

test.beforeEach(async ({ request }) => {
  await resetState(request);
});

const settings = async (page: Page) => (await page.request.get('/api/settings')).json();

async function openSettings(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible();
  await tap(page.locator('.btn-settings'));
  await expect(page.locator('.flowtitle')).toHaveText('Einstellungen');
}

async function menu(page: Page, label: string): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const item = page.locator('.menu-item', { hasText: label });
    if (await item.count()) return tap(item);
    if ((await page.locator('.btn-next').getAttribute('aria-disabled')) === 'true') break;
    await tap(page.locator('.btn-next'));
  }
  throw new Error(`Menüpunkt „${label}“ nicht gefunden`);
}

test.describe('Einführung (SPEC §8.8)', () => {
  test('erscheint beim ersten Start, führt durch alle Schritte und speichert nach Rückfrage', async ({
    page,
    request,
  }) => {
    await request.put('/api/intro', { data: { state: 'neu', step: 1 } });
    await page.goto('/');
    await expect(page.locator('.flowtitle')).toHaveText('Willkommen bei Augenblick');
    await expect(page.locator('.meta')).toHaveText('Schritt 1 von 6');
    await checkScreen(page);
    await tap(page.locator('.btn-next'));

    // Schrift: beginnt bei 18 pt
    await expect(page.locator('.bar .pageinfo')).toHaveText(
      `Stufe 1 von ${CALIBRATION_SIZES_PX.length}`,
    );
    await expect(page.locator('.sample')).toHaveCSS('font-size', `${CALIBRATION_SIZES_PX[0]}px`);
    await tap(page.getByRole('button', { name: 'Größer', exact: true }));
    await expect(page.locator('.sample')).toHaveCSS('font-size', `${CALIBRATION_SIZES_PX[1]}px`);
    await checkScreen(page);
    await tap(page.locator('.btn-next'));

    // Farben
    await tap(page.locator('button', { hasText: 'Andere Farben zeigen' }));
    await expect(page.locator('.sample')).toHaveCSS('background-color', 'rgb(250, 247, 240)');
    await checkScreen(page);
    await tap(page.locator('.btn-next'));

    // Blättern üben
    await expect(page.locator('.flowhint')).toContainText('Weiter');
    await tap(page.locator('.btn-next'));
    await expect(page.locator('.flowhint')).toHaveText('Gut, das war es schon.');
    await tap(page.locator('.btn-next'));

    // Artikel öffnen und zurück
    await expect(page.locator('.btn-next')).toHaveAttribute('aria-disabled', 'true');
    await checkScreen(page);
    await tap(page.locator('.practice-card').first());
    await tap(page.locator('.btn-overview'));
    await expect(page.locator('.flowhint')).toHaveText('Gut, das war es schon.');
    await tap(page.locator('.btn-next'));

    // Fertig: Einverständnis, Werte, zweistufiges Speichern
    await tap(page.locator('button', { hasText: /^Ja$/ }));
    await expect(page.locator('.flowpage')).toContainText('Stufe 2 von');
    await expect(page.locator('.flowpage')).toContainText('hell');
    await checkScreen(page);
    await tap(page.locator('.btn-next'));
    await expect(page.locator('.flowtitle')).toHaveText('Soll das ab jetzt immer so bleiben?');
    await checkScreen(page);
    await tap(page.locator('.btn-yes'));

    await expect(page.locator('.card').first()).toBeVisible();
    expect(await settings(page)).toMatchObject({
      fontSizePx: CALIBRATION_SIZES_PX[1],
      theme: 'light',
      interestLearning: true,
    });
    expect((await (await request.get('/api/intro')).json()).state).toBe('fertig');
    await page.reload();
    await expect(page.locator('.card').first()).toBeVisible();
  });

  test('„Nein, wie vorher“ lässt alles, wie es war', async ({ page, request }) => {
    await request.put('/api/intro', { data: { state: 'neu', step: 1 } });
    await page.goto('/');
    await tap(page.locator('.btn-next'));
    await tap(page.locator('.btn-next')); // 18 pt angenehm
    await tap(page.locator('.btn-skip')); // Farben überspringen
    await tap(page.locator('.btn-skip'));
    await tap(page.locator('.btn-skip'));
    await tap(page.locator('.btn-next'));
    await tap(page.locator('.btn-no'));
    expect(await settings(page)).toMatchObject({
      fontSizePx: DEFAULT_SETTINGS.fontSizePx,
      theme: DEFAULT_SETTINGS.theme,
    });
  });

  test('pausieren und an derselben Stelle weitermachen', async ({ page, request }) => {
    await request.put('/api/intro', { data: { state: 'neu', step: 1 } });
    await page.goto('/');
    await tap(page.locator('.btn-next'));
    await tap(page.locator('.btn-next'));
    await expect(page.locator('.meta')).toHaveText('Schritt 3 von 6');
    await tap(page.locator('.btn-overview'));
    await expect(page.locator('.card').first()).toBeVisible();
    // Neu öffnen: keine erzwungene Einführung, aber „fortsetzen“ in den Einstellungen.
    await page.reload();
    await expect(page.locator('.card').first()).toBeVisible();
    await tap(page.locator('.btn-settings'));
    await menu(page, 'Einführung fortsetzen');
    await expect(page.locator('.meta')).toHaveText('Schritt 3 von 6');
  });
});

test.describe('Einstellungen der Nutzerin (SPEC §8.7)', () => {
  test('Übersicht hat die Taste „Einstellungen“, höchstens 6 Tippziele', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.btn-settings')).toContainText('Einstellungen');
    await checkScreen(page);
  });

  test('Schrift einstellen: Vorschau sofort, gespeichert erst nach „Ja, so lassen“', async ({
    page,
  }) => {
    await openSettings(page);
    await checkScreen(page);
    await menu(page, 'Schrift einstellen');
    await tap(page.getByRole('button', { name: 'Größer', exact: true }));
    await tap(page.getByRole('button', { name: 'Größer', exact: true }));
    await expect(page.locator('.sample')).toHaveCSS('font-size', `${CALIBRATION_SIZES_PX[2]}px`);
    await checkScreen(page);
    await tap(page.getByRole('button', { name: 'Das ist angenehm' }));
    await expect(page.locator('.flowtitle')).toHaveText('Soll das ab jetzt immer so bleiben?');
    expect((await settings(page)).fontSizePx).toBe(DEFAULT_SETTINGS.fontSizePx);
    await tap(page.locator('.btn-yes'));
    expect((await settings(page)).fontSizePx).toBe(CALIBRATION_SIZES_PX[2]);
    await expect(page.locator('body')).toHaveCSS('font-size', `${CALIBRATION_SIZES_PX[2]}px`);
    // Eine Einzeländerung der Leserin, keine Kalibrierung: „Wie am Anfang“ bleibt (Auftrag 004, B6).
    const view = await (await page.request.get('/api/technik/settings')).json();
    expect(view.history[0].source).toBe('nutzerin');
    expect((await (await page.request.get('/api/settings/baseline')).json()).fontSizePx).toBe(
      DEFAULT_SETTINGS.fontSizePx,
    );
  });

  test('„Nein, wie vorher“ und Verlassen über „Übersicht“ ändern nichts', async ({ page }) => {
    await openSettings(page);
    await menu(page, 'Farben');
    await tap(page.getByRole('button', { name: 'Hell', exact: true }));
    await expect(page.locator('.sample')).toHaveCSS('background-color', 'rgb(250, 247, 240)');
    await tap(page.locator('button', { hasText: 'Speichern' }));
    await tap(page.locator('.btn-no'));
    expect((await settings(page)).theme).toBe('dark');

    await menu(page, 'Farben');
    await tap(page.getByRole('button', { name: 'Hell', exact: true }));
    await tap(page.locator('.btn-overview'));
    await expect(page.locator('.card').first()).toBeVisible();
    expect((await settings(page)).theme).toBe('dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  });

  test('„Wie am Anfang“ holt die zuletzt eingestellte Schrift zurück', async ({
    page,
    request,
  }) => {
    await request.put('/api/settings', {
      data: { source: 'kalibrierung', settings: { fontSizePx: 38 } },
    });
    await request.put('/api/settings', {
      data: { source: 'nutzerin', settings: { fontSizePx: 60 } },
    });
    await openSettings(page);
    await menu(page, 'Wie am Anfang');
    await expect(page.locator('.flowtitle')).toHaveText('Soll das ab jetzt immer so bleiben?');
    await expect(page.locator('.sample')).toHaveCSS('font-size', '38px');
    await tap(page.locator('.btn-yes'));
    expect((await settings(page)).fontSizePx).toBe(38);
  });

  test('Prüfungen nach §14 auf allen Einstellungsseiten bei großer Schrift', async ({
    page,
    request,
  }) => {
    await request.put('/api/settings', {
      data: { source: 'nutzerin', settings: { fontSizePx: 40, theme: 'light' } },
    });
    await openSettings(page);
    await checkScreen(page);
    for (const label of ['Schrift einstellen', 'Farben', 'Zeilenabstand']) {
      await menu(page, label);
      await checkScreen(page);
      await tap(page.locator('.btn-back'));
    }
  });
});

test.describe('Was ich gern lese (SPEC §5.3)', () => {
  test('Einverständnis, gelernte Themen, „mehr davon“ mit Rückfrage', async ({ page, request }) => {
    await openSettings(page);
    await menu(page, 'Was ich gern lese');
    await expect(page.locator('.flowhint')).toContainText('Einverstanden?');
    await tap(page.locator('button', { hasText: /^Ja$/ }));
    await tap(page.locator('.btn-yes'));
    expect((await settings(page)).interestLearning).toBe(true);

    // Lesen erzeugt Themen-Punkte (nur mit Einverständnis).
    const edition = await (await request.get('/api/edition')).json();
    await request.post('/api/reading', {
      data: { articleId: edition.articles[0].id, reachedEnd: true, seconds: 200 },
    });

    await menu(page, 'Was ich gern lese');
    await expect(page.locator('.flowtitle')).toHaveText('Region');
    await checkScreen(page);
    await tap(page.locator('button', { hasText: 'Mehr davon' }));
    await tap(page.locator('.btn-next'));
    await tap(page.locator('button', { hasText: 'Speichern' }));
    await tap(page.locator('.btn-yes'));
    const list = await (await request.get('/api/interests')).json();
    expect(list[0]).toMatchObject({ topic: 'Region', weight: 7 });
  });

  test('„Nein, lieber nicht“ läuft ebenfalls über die Rückfrage', async ({ page, request }) => {
    // Noch nie gefragt.
    await request.put('/api/settings', {
      data: { source: 'nutzerin', settings: { interestLearning: null } },
    });
    await openSettings(page);
    await menu(page, 'Was ich gern lese');
    await tap(page.locator('button', { hasText: 'Nein, lieber nicht' }));
    await expect(page.locator('.flowtitle')).toHaveText('Soll das ab jetzt immer so bleiben?');
    await checkScreen(page);
    expect((await settings(page)).interestLearning).toBe(null);
    await tap(page.locator('.btn-no'));
    expect((await settings(page)).interestLearning).toBe(null);
    await menu(page, 'Was ich gern lese');
    await tap(page.locator('button', { hasText: 'Nein, lieber nicht' }));
    await tap(page.locator('.btn-yes'));
    expect((await settings(page)).interestLearning).toBe(false);
  });
});

test.describe('Anrede (SPEC §8.7)', () => {
  test('„du“ aus dem Technik-Bereich gilt in den Texten der Nutzerin', async ({
    page,
    request,
  }) => {
    await request.put('/api/technik/settings', { data: { salutation: 'du' } });
    await openSettings(page);
    await menu(page, 'Schrift einstellen');
    await expect(page.locator('.flowhint')).toContainText('Tippe auf');
  });
});

test.describe('Technik-Bereich (SPEC §10)', () => {
  test('ohne PIN: Status, Verlauf und Zurücksetzen auf eine frühere Fassung', async ({
    page,
    request,
  }) => {
    await request.put('/api/settings', {
      data: { source: 'kalibrierung', settings: { fontSizePx: 38 } },
    });
    await request.put('/api/settings', {
      data: { source: 'nutzerin', settings: { fontSizePx: 76 } },
    });
    await page.goto('/technik');
    await expect(page.locator('.facts').first()).toContainText('Version');
    await expect(page.locator('body')).toContainText('kein OPENROUTER_API_KEY');

    await page.click('text=Leseeinstellungen');
    await expect(page.locator('table tbody tr').first()).toContainText('Leserin');
    page.once('dialog', (d) => void d.accept());
    await page.locator('tr', { hasText: 'Schrift eingestellt' }).first().locator('button').click();
    await expect(page.locator('table tbody tr').first()).toContainText('Technik-Bereich');
    expect((await settings(page)).fontSizePx).toBe(38);
  });

  test('Spickzettel mit Einstellungen und Funkelstern', async ({ page }) => {
    await page.goto('/technik#spickzettel');
    await expect(page.locator('.sheet h1')).toHaveText('So lesen Sie Ihre Zeitung');
    await expect(page.locator('.sheet li')).toHaveCount(6);
    await expect(page.locator('.sheet .spark')).toBeVisible();
  });
});
