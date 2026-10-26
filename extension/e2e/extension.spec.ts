/**
 * Augenblick für Firefox (Auftrag 008, ADR 024): Taste „Lesen“, Leseansicht, Schließen mit Knopf
 * und Zurück-Geste, keine eigenen Netzabrufe, §14-Prüfungen der Leseansicht bei allen Schriftstufen.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Frame, type Locator, type Page } from '@playwright/test';
import { parseHTML } from 'linkedom';
import {
  CALIBRATION_SIZES_PX,
  EDGE_MM,
  mm,
  TAP_REPEAT_MS,
  TAP_TARGET_MM,
} from '@augenblick/shared';
import { checkScreen, tap } from '../../web/e2e/helpers.ts';
import { extractArticle } from '../src/extract.ts';

const PAGE = 'http://127.0.0.1:8141';
const EXT = 'http://localhost:8142';

const readButton = (page: Page): Locator => page.locator('augenblick-lesen');

/** Tipp mit dem Finger auf die Mitte eines Elements (die Taste liegt im geschlossenen Shadow DOM). */
async function tapCenter(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('Element nicht sichtbar');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(TAP_REPEAT_MS + 50);
}

async function readerFrame(page: Page): Promise<Frame> {
  await expect.poll(() => page.frames().some((f) => f.url().startsWith(EXT))).toBe(true);
  const frame = page.frames().find((f) => f.url().startsWith(EXT));
  if (!frame) throw new Error('Leseansicht fehlt');
  await frame.waitForSelector('.screen.reading, .notice:not(:empty)');
  return frame;
}

async function openReader(page: Page): Promise<Frame> {
  await expect(readButton(page)).toBeVisible();
  await tapCenter(page, readButton(page));
  return readerFrame(page);
}

test.describe('Taste „Lesen“ (SPEC §16.2)', () => {
  for (const name of ['artikel', 'banner']) {
    test(`erscheint auf ${name}.html, unten rechts, 20 mm`, async ({ page }) => {
      await page.goto(`/${name}.html`);
      const button = readButton(page);
      await expect(button).toBeVisible();
      const box = (await button.boundingBox())!;
      const vp = page.viewportSize()!;
      expect(box.height).toBeGreaterThanOrEqual(mm(TAP_TARGET_MM) - 1);
      expect(vp.width - (box.x + box.width)).toBeGreaterThanOrEqual(mm(EDGE_MM) - 1);
      expect(vp.height - (box.y + box.height)).toBeGreaterThanOrEqual(mm(EDGE_MM) - 1);
      // Über allem, auch über dem Cookie-Banner.
      const onTop = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x!, y!)?.localName,
        [box.x + box.width / 2, box.y + box.height / 2],
      );
      expect(onTop).toBe('augenblick-lesen');
    });
  }

  for (const name of ['start', 'login']) {
    test(`erscheint nicht auf ${name}.html`, async ({ page }) => {
      await page.goto(`/${name}.html`);
      await page.waitForTimeout(1500);
      await expect(readButton(page)).toHaveCount(0);
    });
  }

  test('erscheint, sobald ein nachgeladener Artikel da ist', async ({ page }) => {
    await page.goto('/nachgeladen.html');
    await expect(page.locator('article h1')).toBeVisible();
    await expect(readButton(page)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Leseansicht (SPEC §16.3, §16.4)', () => {
  test('zeigt Titel, sauberen Fließtext und die Bilder der Seite', async ({ page }) => {
    await page.goto('/artikel.html');
    const frame = await openReader(page);
    await expect(frame.locator('h1')).toHaveText('Neues Dach für den Wochenmarkt');
    await expect(frame.locator('.meta')).toHaveText('Musterstädter Anzeiger');
    await expect(frame.locator('h2')).toHaveText([
      'Was sich für die Besucher ändert',
      'Wie es weitergeht',
    ]);
    const text = (await frame.locator('.prose').textContent()) ?? '';
    expect(text).toContain('Der Wochenmarkt in Musterstadt bekommt ein festes Dach.');
    expect(text).not.toMatch(/Foto: Testbild|Mehr zum Thema|Parkgebühren|Impressum/);
    const images = frame.locator('.article-image img');
    await expect(images).toHaveCount(2);
    await expect
      .poll(() =>
        images.evaluateAll((els) => els.every((i) => (i as HTMLImageElement).naturalWidth > 0)),
      )
      .toBe(true);
    await expect(frame.locator('figcaption')).toHaveCount(0);
    // Die Taste „Lesen“ ist weg, solange die Leseansicht offen ist.
    await expect(readButton(page)).toHaveCount(0);
    await checkScreen(frame);
  });

  test('„Zur Seite“ schließt, die Seite steht an derselben Stelle', async ({ page }) => {
    await page.goto('/artikel.html');
    await page.evaluate(() => window.scrollTo(0, 300));
    const before = await page.evaluate(() => ({
      y: window.scrollY,
      len: history.length,
      url: location.href,
    }));
    const frame = await openReader(page);
    // Wischen in der Leseansicht bewegt die Seite darunter nicht.
    await frame.locator('.article-scroll').evaluate((el) => el.scrollBy(0, 400));
    await tap(frame.locator('.btn-to-page'));
    await expect.poll(() => page.frames().some((f) => f.url().startsWith(EXT))).toBe(false);
    const after = await page.evaluate(() => ({ y: window.scrollY, url: location.href }));
    expect(after).toEqual({ y: before.y, url: before.url });
    await expect(readButton(page)).toBeVisible();
    // Erneut öffnen geht.
    await openReader(page);
  });

  test('Zurück-Geste schließt die Leseansicht, nicht die Seite', async ({ page }) => {
    await page.goto('/banner.html');
    await page.evaluate(() => window.scrollTo(0, 120));
    const y = await page.evaluate(() => window.scrollY);
    await openReader(page);
    await page.goBack();
    await expect.poll(() => page.frames().some((f) => f.url().startsWith(EXT))).toBe(false);
    expect(page.url()).toBe(`${PAGE}/banner.html`);
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
    await expect(readButton(page)).toBeVisible();
  });

  test('Ersatzweg über das Menü; ohne Artikel ein ruhiger Hinweis', async ({ page }) => {
    await page.goto('/start.html');
    await page.evaluate(() =>
      (window as unknown as { __augenblickMenu: () => void }).__augenblickMenu(),
    );
    const frame = await readerFrame(page);
    await expect(frame.locator('.notice')).toHaveText(
      'Diese Seite lässt sich leider nicht als Text anzeigen.',
    );
    await checkScreen(frame);
    await tap(frame.locator('.btn-to-page'));
    await expect.poll(() => page.frames().some((f) => f.url().startsWith(EXT))).toBe(false);
  });

  test('die Seite kann der Leseansicht keinen Text unterschieben', async ({ page }) => {
    await page.goto('/artikel.html');
    const frame = await openReader(page);
    // Fremde Nachricht ohne das Kennwort aus der Adresse der Leseansicht.
    await page.evaluate(() => {
      for (const f of Array.from(window.frames))
        f.postMessage({ type: 'augenblick:article', token: 'geraten', article: null }, '*');
    });
    await page.waitForTimeout(300);
    await expect(frame.locator('h1')).toHaveText('Neues Dach für den Wochenmarkt');
  });
});

test('keine eigenen Netzabrufe (SPEC §16.7)', async ({ page }) => {
  const requests: { url: string; frame: string }[] = [];
  page.on('request', (r) => requests.push({ url: r.url(), frame: r.frame().url() }));
  await page.goto('/artikel.html');
  await expect(readButton(page)).toBeVisible();
  const pageImages = new Set(requests.filter((r) => /\/bilder\//.test(r.url)).map((r) => r.url));
  const frame = await openReader(page);
  await expect
    .poll(() =>
      frame
        .locator('.article-image img')
        .evaluateAll((els) => els.length > 0 && els.every((i) => (i as HTMLImageElement).complete)),
    )
    .toBe(true);
  // Nur die Testseite und die Dateien der Erweiterung – kein anderer Server.
  for (const r of requests)
    expect(r.url, r.url).toMatch(/^(http:\/\/127\.0\.0\.1:8141|http:\/\/localhost:8142)\//);
  // Aus der Leseansicht: nur eigene Dateien und Bilder, die die Seite selbst schon geladen hatte.
  const fromReader = requests.filter((r) => r.frame.startsWith(EXT) && !r.url.startsWith(EXT));
  for (const r of fromReader) expect(pageImages.has(r.url), r.url).toBe(true);
});

test.describe('Leseansicht bei allen Schriftstufen (SPEC §14)', () => {
  const html = readFileSync(
    path.resolve(import.meta.dirname, '../test/pages/artikel.html'),
    'utf8',
  );
  const article = extractArticle(parseHTML(html).document as unknown as Document, {
    loadedImage: (img) => {
      const src = img.getAttribute('src');
      const width = Number(img.getAttribute('width'));
      const height = Number(img.getAttribute('height'));
      return src && width && height ? { src: new URL(src, PAGE).toString(), width, height } : null;
    },
    parseHtml: (s) =>
      parseHTML(`<!doctype html><html><body>${s}</body></html>`).document as unknown as Document,
  });

  for (const fontSizePx of CALIBRATION_SIZES_PX) {
    test(`${fontSizePx} px`, async ({ page }) => {
      const vorschau = encodeURIComponent(JSON.stringify({ fontSizePx }));
      await page.goto(`${EXT}/reader.html?vorschau=${vorschau}#kennwort`);
      await page.evaluate(
        (a) =>
          window.postMessage({ type: 'augenblick:article', token: 'kennwort', article: a }, '*'),
        article,
      );
      await expect(page.locator('h1')).toHaveText('Neues Dach für den Wochenmarkt');
      expect(await page.evaluate(() => getComputedStyle(document.body).fontSize)).toBe(
        `${fontSizePx}px`,
      );
      await checkScreen(page);
      // Ans Ende scrollen: auch dort bleibt alles in Ordnung.
      await page.locator('.article-scroll').evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await checkScreen(page);
    });
  }
});
