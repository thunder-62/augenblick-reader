import { expect, type Locator, type Page } from '@playwright/test';
import {
  contrastRatio,
  EDGE_MM,
  MAX_TAP_TARGETS,
  mm,
  TAP_GAP_MM,
  TAP_MIN_MM,
  TAP_REPEAT_MS,
} from '@augenblick/shared';

/** Ein Tipp wie mit dem Finger: drücken, kurz halten, loslassen – danach die Doppeltipp-Sperre abwarten. */
export async function tap(target: Locator): Promise<void> {
  await target.click({ delay: 120 });
  await target.page().waitForTimeout(TAP_REPEAT_MS + 50);
}

/** Einstellungen für einen Test überschreiben (Schema, Schriftgröße). */
export async function withSettings(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.route('**/api/settings', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ json: { ...(await res.json()), ...patch } });
  });
}

export async function pageInfo(page: Page): Promise<{ page: number; total: number }> {
  const text = (await page.locator('.pageinfo').textContent()) ?? '';
  const m = /Seite (\d+) von (\d+)/.exec(text);
  expect(m, `Seitenangabe „${text}“`).not.toBeNull();
  return { page: Number(m?.[1]), total: Number(m?.[2]) };
}

type Rect = { x: number; y: number; width: number; height: number; label: string };

/** Prüft die Regeln aus SPEC §8.1/§14 für den aktuellen Bildschirm. */
export async function checkScreen(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const doc = document.scrollingElement ?? document.documentElement;

    const targets: Rect[] = [];
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a[href], [role="button"], input, select, textarea',
      ),
    )) {
      if (el.closest('.measure')) continue;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none')
        continue;
      targets.push({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        label: (el.textContent ?? '').trim().slice(0, 30),
      });
    }

    // Effektiver Hintergrund: erster nicht transparenter Vorfahr.
    const bgOf = (el: Element | null): string => {
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        if (c && !/rgba\(.*,\s*0\)$/.test(c) && c !== 'transparent') return c;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const texts: { fg: string; bg: string; text: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim() || el.closest('.measure, .sr-only, script, style'))
        continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      texts.push({
        fg: getComputedStyle(el).color,
        bg: bgOf(el),
        text: n.textContent.trim().slice(0, 30),
      });
    }

    // Bereiche mit verstecktem Überlauf dürfen nichts abschneiden.
    const clipped = Array.from(document.querySelectorAll<HTMLElement>('.page, .cards'))
      .filter((el) => !el.closest('.measure') && el.scrollHeight > el.clientHeight + 1)
      .map((el) => `${el.className}: ${el.scrollHeight} > ${el.clientHeight}`);

    // Elemente mit sichtbaren Scrollbalken
    const scrollable = Array.from(document.querySelectorAll<HTMLElement>('*'))
      .filter((el) => {
        const s = getComputedStyle(el);
        return (
          /(auto|scroll)/.test(s.overflowY + s.overflowX) &&
          (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)
        );
      })
      .map((el) => el.tagName + '.' + el.className);

    return {
      vw,
      vh,
      docScroll: { w: doc.scrollWidth, h: doc.scrollHeight },
      targets,
      texts,
      clipped,
      scrollable,
    };
  });

  // Keine Scrollbalken, nichts abgeschnitten
  expect(result.docScroll.w, 'Seite breiter als der Bildschirm').toBeLessThanOrEqual(result.vw);
  expect(result.docScroll.h, 'Seite höher als der Bildschirm').toBeLessThanOrEqual(result.vh);
  expect(result.scrollable, 'scrollbare Elemente').toEqual([]);
  expect(result.clipped, 'abgeschnittener Inhalt').toEqual([]);

  // Höchstens 6 Tippziele
  expect(result.targets.length, 'Anzahl Tippziele').toBeLessThanOrEqual(MAX_TAP_TARGETS);

  // Größe, Randabstand, Abstand untereinander
  const min = mm(TAP_MIN_MM);
  const edge = mm(EDGE_MM);
  const gap = mm(TAP_GAP_MM);
  for (const t of result.targets) {
    expect(t.width, `Breite „${t.label}“`).toBeGreaterThanOrEqual(min);
    expect(t.height, `Höhe „${t.label}“`).toBeGreaterThanOrEqual(min);
    expect(t.x, `Randabstand links „${t.label}“`).toBeGreaterThanOrEqual(edge - 0.5);
    expect(t.y, `Randabstand oben „${t.label}“`).toBeGreaterThanOrEqual(edge - 0.5);
    expect(result.vw - (t.x + t.width), `Randabstand rechts „${t.label}“`).toBeGreaterThanOrEqual(
      edge - 0.5,
    );
    expect(result.vh - (t.y + t.height), `Randabstand unten „${t.label}“`).toBeGreaterThanOrEqual(
      edge - 0.5,
    );
  }
  result.targets.forEach((a, i) => {
    result.targets.slice(i + 1).forEach((b) => {
      const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0);
      const dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0);
      expect(Math.max(dx, dy), `Abstand „${a.label}“ ↔ „${b.label}“`).toBeGreaterThanOrEqual(
        gap - 0.5,
      );
    });
  });

  // Kontrast ≥ 7:1 für allen Text
  expect(result.texts.length).toBeGreaterThan(0);
  for (const t of result.texts) {
    expect(
      contrastRatio(t.fg, t.bg),
      `Kontrast „${t.text}“ (${t.fg} auf ${t.bg})`,
    ).toBeGreaterThanOrEqual(7);
  }
}
