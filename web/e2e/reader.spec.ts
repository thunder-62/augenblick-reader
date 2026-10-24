import { expect, test } from '@playwright/test';
import { TAP_MIN_DURATION_MS } from '@augenblick/shared';
import { checkScreen, pageInfo, tap, withSettings } from './helpers.ts';

test.describe('Übersicht', () => {
  test('zeigt Datum, Karten und blättert per Taste', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.date')).toContainText(/\w+, \d+\. \w+/);
    await expect(page.locator('.card').first()).toBeVisible();
    const cards = await page.locator('.card').count();
    expect(cards).toBeGreaterThanOrEqual(1);
    expect(cards).toBeLessThanOrEqual(3);

    const start = await pageInfo(page);
    expect(start.page).toBe(1);
    expect(start.total).toBeGreaterThan(1);
    await expect(page.locator('.btn-back')).toHaveAttribute('aria-disabled', 'true');

    await tap(page.locator('.btn-next'));
    expect((await pageInfo(page)).page).toBe(2);
    await tap(page.locator('.btn-back'));
    expect((await pageInfo(page)).page).toBe(1);

    for (let i = 1; i < start.total; i++) await tap(page.locator('.btn-next'));
    expect((await pageInfo(page)).page).toBe(start.total);
    await expect(page.locator('.btn-next')).toHaveAttribute('aria-disabled', 'true');
    // Inaktive Taste bleibt sichtbar, Tippen bewirkt nichts.
    await page.locator('.btn-next').click({ delay: 120, force: true });
    await page.waitForTimeout(400);
    expect((await pageInfo(page)).page).toBe(start.total);
  });

  test('Karte zeigt Rubrik, Titel, Kurzfassung und Lesezeit', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.card').first();
    await expect(card.locator('.rubric')).toContainText('Region');
    await expect(card.locator('.title')).not.toBeEmpty();
    await expect(card.locator('.summary')).not.toBeEmpty();
    await expect(card.locator('.time')).toContainText(/ca\. \d+ Minuten?/);
  });
});

test.describe('Artikel', () => {
  test('öffnen, blättern, zurück zur Übersicht', async ({ page }) => {
    await page.goto('/');
    const title = (await page.locator('.card .title').first().textContent()) ?? '';
    await tap(page.locator('.card').first());
    await expect(page.locator('.prose h1')).toHaveText(title);
    await expect(page.locator('.btn-overview')).toBeVisible();

    const info = await pageInfo(page);
    expect(info.page).toBe(1);
    expect(info.total).toBeGreaterThan(1);
    await tap(page.locator('.btn-next'));
    expect((await pageInfo(page)).page).toBe(2);
    await expect(page.locator('.prose h1')).toHaveCount(0);
    await tap(page.locator('.btn-back'));
    expect((await pageInfo(page)).page).toBe(1);

    await tap(page.locator('.btn-overview'));
    await expect(page.locator('.card').first()).toBeVisible();
    // gelesen: dezentes Häkchen
    await expect(page.locator('.card').first().locator('.read')).toBeVisible();
  });

  test('kein Satz wird über eine Seite hinweg geteilt und keiner geht verloren', async ({
    page,
    request,
  }) => {
    const edition = await (await request.get('/api/edition')).json();
    const id = edition.articles[0].id as string;
    const article = await (await request.get(`/api/articles/${id}`)).json();
    const expected = article.blocks.flatMap(
      (b: { type: string; sentences?: string[] }) => b.sentences ?? [],
    ).length;

    await page.goto('/');
    await tap(page.locator('.card').first());
    const { total } = await pageInfo(page);
    const seen: string[] = [];
    for (let p = 1; p <= total; p++) {
      seen.push(
        ...(await page
          .locator('.prose .s')
          .evaluateAll((els) => els.map((e) => e.getAttribute('data-s') ?? ''))),
      );
      await checkScreen(page);
      if (p < total) await tap(page.locator('.btn-next'));
    }
    expect(seen).toHaveLength(expected);
    expect(new Set(seen).size).toBe(expected);
  });

  test('am Ende: „Nächster Artikel“ mit Titel', async ({ page }) => {
    await page.goto('/');
    const titles = await page.locator('.card .title').allTextContents();
    await tap(page.locator('.card').first());
    const { total } = await pageInfo(page);
    for (let i = 1; i < total; i++) await tap(page.locator('.btn-next'));
    const next = page.locator('.btn-next');
    await expect(next).toContainText('Nächster Artikel');
    await checkScreen(page);
    await tap(next);
    expect((await pageInfo(page)).page).toBe(1);
    const secondTitle = (await page.locator('.prose h1').textContent()) ?? '';
    expect(secondTitle).not.toBe(titles[0]);
    await expect(page.locator('.prose h1')).not.toBeEmpty();
  });

  test('nach Neuladen: derselbe Artikel auf derselben Seite', async ({ page }) => {
    await page.goto('/');
    await tap(page.locator('.card').first());
    await tap(page.locator('.btn-next'));
    await tap(page.locator('.btn-next'));
    const before = await pageInfo(page);
    const text = await page.locator('.prose').textContent();
    await page.reload();
    await expect(page.locator('.prose')).toHaveText(text ?? '');
    expect(await pageInfo(page)).toEqual(before);

    // Zurück zur Übersicht landet auf der Seite mit diesem Artikel.
    await tap(page.locator('.btn-overview'));
    await expect(page.locator('.card').first()).toBeVisible();
  });

  test('nicht mehr vorhandener Artikel: Hinweis und Weg zur Übersicht', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible();
    await page.evaluate(() =>
      localStorage.setItem(
        'augenblick.v1.state',
        JSON.stringify({ view: 'article', articleId: 'gibt-es-nicht' }),
      ),
    );
    await page.reload();
    await expect(page.locator('.notice')).toContainText('nicht mehr da');
    await tap(page.locator('.btn-overview'));
    await expect(page.locator('.card').first()).toBeVisible();
  });
});

test.describe('Tipp-Logik', () => {
  test('zu kurze Berührung löst nichts aus', async ({ page }) => {
    await page.goto('/');
    await page.locator('.btn-next').click({ delay: TAP_MIN_DURATION_MS / 4 });
    await page.waitForTimeout(400);
    expect((await pageInfo(page)).page).toBe(1);
  });

  test('Doppeltipp blättert nur eine Seite', async ({ page }) => {
    await page.goto('/');
    await page.locator('.btn-next').click({ delay: 100 });
    await page.locator('.btn-next').click({ delay: 100 });
    await page.waitForTimeout(400);
    expect((await pageInfo(page)).page).toBe(2);
  });

  test('Finger verrutscht über 10 mm: kein Tipp', async ({ page }) => {
    await page.goto('/');
    const box = (await page.locator('.btn-next').boundingBox())!;
    await page.mouse.move(box.x + box.width - 5, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + 5, box.y + box.height - 5, { steps: 5 });
    await page.waitForTimeout(120);
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect((await pageInfo(page)).page).toBe(1);
  });

  test('keine Textauswahl, kein Zoom', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => getComputedStyle(document.body).userSelect)).toBe('none');
    expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).toBe('none');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /user-scalable=no/,
    );
  });
});

test.describe('Prüfungen nach SPEC §14', () => {
  for (const theme of ['dark', 'light'] as const) {
    for (const fontSizePx of [24, 30, 40]) {
      test(`${theme}, ${fontSizePx} px: Kontrast, Tippziele, keine Scrollbalken`, async ({
        page,
      }) => {
        await withSettings(page, { theme, fontSizePx });
        await page.goto('/');
        await expect(page.locator('.card').first()).toBeVisible();
        await checkScreen(page);
        await tap(page.locator('.btn-next'));
        await checkScreen(page);

        await tap(page.locator('.card').first());
        await expect(page.locator('.prose')).not.toBeEmpty();
        await checkScreen(page);
        await tap(page.locator('.btn-next'));
        await checkScreen(page);
      });
    }
  }

  test('keine externen Requests', async ({ page, baseURL }) => {
    const foreign: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(baseURL ?? '') && !r.url().startsWith('data:')) foreign.push(r.url());
    });
    await page.goto('/');
    await tap(page.locator('.card').first());
    await expect(page.locator('.prose')).not.toBeEmpty();
    expect(foreign).toEqual([]);
    expect(await page.evaluate(() => document.fonts.check('30px "Atkinson Hyperlegible"'))).toBe(
      true,
    );
  });
});

test.describe('Ausfälle', () => {
  test('Server nicht erreichbar: ruhiger Hinweis statt Fehlermeldung', async ({ page }) => {
    await page.route('**/api/edition', (route) => route.fulfill({ status: 503, body: '' }));
    await page.goto('/');
    await expect(page.locator('.notice')).toContainText('nicht erreichbar');
    await checkScreen(page);
  });

  test('noch keine Ausgabe: Hinweis, dass sie von selbst erscheint', async ({ page }) => {
    await page.route('**/api/edition', (route) =>
      route.fulfill({ json: { day: null, updatedAt: null, articles: [] } }),
    );
    await page.goto('/');
    await expect(page.locator('.notice')).toContainText('von selbst');
  });
});
