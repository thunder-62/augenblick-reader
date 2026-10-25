import { expect, test } from '@playwright/test';
import { EDGE_MM, mm, TAP_MIN_DURATION_MS } from '@augenblick/shared';
import { checkScreen, pageInfo, resetState, tap, withSettings } from './helpers.ts';

test.beforeEach(async ({ request }) => {
  await resetState(request);
});

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

/** Im Fließtext ein Stück weiter wischen (ADR 018). */
async function scrollBy(page: import('@playwright/test').Page, px: number): Promise<void> {
  await page.locator('.article-scroll').evaluate((el, d) => el.scrollBy(0, d), px);
  await page.waitForTimeout(150);
}

test.describe('Artikel (Fließtext, ADR 018)', () => {
  test('öffnen, scrollen, über den runden Knopf zurück zur Übersicht', async ({ page }) => {
    await page.goto('/');
    const title = (await page.locator('.card .title').first().textContent()) ?? '';
    await tap(page.locator('.card').first());
    await expect(page.locator('.prose h1')).toHaveText(title);
    const back = page.locator('.btn-round');
    await expect(back).toBeVisible();
    await expect(back).toContainText('Übersicht');
    await checkScreen(page);

    // Der Text scrollt, der Knopf bleibt an seinem Platz.
    const before = await back.boundingBox();
    await scrollBy(page, 600);
    expect(await page.locator('.article-scroll').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await back.boundingBox()).toEqual(before);
    await checkScreen(page);

    await tap(back);
    await expect(page.locator('.card').first()).toBeVisible();
    await expect(page.locator('.card').first().locator('.read')).toBeVisible();
  });

  test('der ganze Text steht da, jeder Satz genau einmal', async ({ page, request }) => {
    const edition = await (await request.get('/api/edition')).json();
    const id = edition.articles[0].id as string;
    const article = await (await request.get(`/api/articles/${id}`)).json();
    const expected = article.blocks.flatMap(
      (b: { type: string; sentences?: string[] }) => b.sentences ?? [],
    ).length;
    await page.goto('/');
    await tap(page.locator('.card').first());
    const seen = await page
      .locator('.prose .s')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-s') ?? ''));
    expect(seen).toHaveLength(expected);
    expect(new Set(seen).size).toBe(expected);
  });

  test('der Text liegt nie unter dem runden Knopf', async ({ page }) => {
    await page.goto('/');
    await tap(page.locator('.card').first());
    const knob = (await page.locator('.btn-round').boundingBox())!;
    const text = (await page.locator('.flowtext').boundingBox())!;
    expect(text.x).toBeGreaterThanOrEqual(knob.x + knob.width);
  });

  test('am Ende: „Nächster Artikel“ mit Titel', async ({ page }) => {
    await page.goto('/');
    const titles = await page.locator('.card .title').allTextContents();
    await tap(page.locator('.card').first());
    await page.locator('.article-scroll').evaluate((el) => (el.scrollTop = el.scrollHeight));
    const next = page.locator('.article-end .btn-next');
    await expect(next).toContainText('Nächster Artikel');
    await checkScreen(page);
    // Ganz unten hält „Nächster Artikel“ den Randabstand von 15 mm ein.
    const box = (await next.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(viewport.height - (box.y + box.height)).toBeGreaterThanOrEqual(mm(EDGE_MM) - 0.5);
    await tap(next);
    await expect(page.locator('.prose h1')).not.toHaveText(titles[0] ?? '');
    expect(await page.locator('.article-scroll').evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('nach Neuladen: derselbe Artikel an derselben Stelle', async ({ page }) => {
    await page.goto('/');
    await tap(page.locator('.card').first());
    await scrollBy(page, 900);
    const firstVisible = async () =>
      page.locator('.article-scroll').evaluate((sc) => {
        const top = sc.getBoundingClientRect().top;
        return Array.from(sc.querySelectorAll<HTMLElement>('.s')).find(
          (s) => (s.getClientRects()[0]?.top ?? -1) >= top - 1,
        )?.dataset.s;
      });
    const before = await firstVisible();
    expect(Number(before)).toBeGreaterThan(0);
    await page.reload();
    await expect(page.locator('.prose h1')).toBeVisible();
    expect(await firstVisible()).toBe(before);

    await tap(page.locator('.btn-round'));
    await expect(page.locator('.card').first()).toBeVisible();
  });

  test('Bilder der Quelle stehen im Text, so breit wie die Spalte (ADR 021)', async ({ page }) => {
    // Bild vom Pi (/media/…), hier im Test selbst erzeugt; keine fremden Bilder im Repo.
    const { deflateSync } = await import('node:zlib');
    const png = (() => {
      const table = Array.from({ length: 256 }, (_, n) => {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        return c >>> 0;
      });
      const crc = (b: Buffer) => {
        let c = 0xffffffff;
        for (const x of b) c = (table[(c ^ x) & 0xff] ?? 0) ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
      };
      const chunk = (t: string, d: Buffer) => {
        const l = Buffer.alloc(4);
        l.writeUInt32BE(d.length);
        const td = Buffer.concat([Buffer.from(t), d]);
        const c = Buffer.alloc(4);
        c.writeUInt32BE(crc(td));
        return Buffer.concat([l, td, c]);
      };
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(640, 0);
      ihdr.writeUInt32BE(360, 4);
      ihdr[8] = 8;
      ihdr[9] = 2;
      const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(640 * 3, 0x60)]);
      return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: 360 }, () => row)))),
        chunk('IEND', Buffer.alloc(0)),
      ]);
    })();
    const name = `${'e'.repeat(40)}.png`;
    await page.route(`**/media/${name}`, (route) =>
      route.fulfill({ body: png, contentType: 'image/png' }),
    );
    await page.route('**/api/articles/*', async (route) => {
      const res = await route.fetch();
      const article = await res.json();
      article.blocks.splice(1, 0, {
        type: 'image',
        src: `/media/${name}`,
        alt: 'Ein Testbild',
        width: 640,
        height: 360,
      });
      await route.fulfill({ json: article });
    });
    await page.goto('/');
    await tap(page.locator('.card').first());
    const img = page.locator('.prose .article-image img');
    await expect(img).toHaveAttribute('alt', 'Ein Testbild');
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(640);
    const imgBox = (await img.boundingBox())!;
    const textBox = (await page.locator('.flowtext').boundingBox())!;
    expect(Math.round(imgBox.width)).toBe(Math.round(textBox.width));
    expect(imgBox.height).toBeLessThanOrEqual(page.viewportSize()!.height / 2 + 1);
    await expect(page.locator('.prose figcaption')).toHaveCount(0);
    await checkScreen(page);
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

  test('Finger verrutscht über 10 mm und kehrt zurück: kein Tipp', async ({ page }) => {
    await page.goto('/');
    const box = (await page.locator('.btn-next').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 120, { steps: 5 });
    await page.mouse.move(x, y, { steps: 5 });
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
        await scrollBy(page, 700);
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

  test('Pi nicht erreichbar beim Öffnen des letzten Artikels: ruhiger Hinweis, Zustand bleibt', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible();
    await tap(page.locator('.card').first());
    await expect(page.locator('.prose h1')).toBeVisible();
    await page.route('**/api/articles/**', (route) => route.abort('connectionrefused'));
    await page.reload();
    await expect(page.locator('.notice')).toContainText('nicht erreichbar');
    await expect(page.locator('.notice')).not.toContainText('nicht mehr da');
    await checkScreen(page);
    // Nach dem Wiederkommen des Pi steht wieder der Artikel da.
    await page.unroute('**/api/articles/**');
    await page.reload();
    await expect(page.locator('.prose h1')).toBeVisible();
  });

  test('nach Mitternacht zeigt die Übersicht das neue Datum', async ({ page }) => {
    // 23:59 in Berlin (Sommerzeit, UTC+2)
    await page.clock.install({ time: new Date('2026-10-24T21:59:00Z') });
    await page.goto('/');
    await expect(page.locator('.date')).toContainText('Samstag, 24. Oktober');
    await page.clock.runFor(2 * 60 * 1000);
    await expect(page.locator('.date')).toContainText('Sonntag, 25. Oktober');
  });

  test('noch keine Ausgabe: Hinweis, dass sie von selbst erscheint', async ({ page }) => {
    await page.route('**/api/edition', (route) =>
      route.fulfill({ json: { day: null, updatedAt: null, articles: [] } }),
    );
    await page.goto('/');
    await expect(page.locator('.notice')).toContainText('von selbst');
  });
});

test.describe('Kurzfassungen (M3)', () => {
  test('KI-Kurzfassung hat den Funkelstern, Anreißer und erste Sätze nicht', async ({ page }) => {
    await page.route('**/api/edition', async (route) => {
      const res = await route.fetch();
      const edition = await res.json();
      edition.articles[0].summaryAi = true;
      await route.fulfill({ json: edition });
    });
    await withSettings(page, { fontSizePx: 24 });
    await page.goto('/');
    const ai = page.locator('.card').first().locator('.summary');
    await expect(ai.locator('svg.spark')).toBeVisible();
    // Kein „KI“- oder „Kurz gesagt“-Text sichtbar, nur das Symbol (SPEC §6).
    const visible = await ai.evaluate((el) => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('.sr-only').forEach((s) => s.remove());
      return copy.textContent ?? '';
    });
    expect(visible).not.toMatch(/KI|Kurz gesagt/);
    await checkScreen(page);
    await tap(page.locator('.btn-next'));
    await expect(page.locator('.card').first().locator('.summary svg.spark')).toHaveCount(0);
  });
});
