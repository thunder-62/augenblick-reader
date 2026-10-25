import { t } from './i18n.ts';

type Attrs = Record<string, string | number | boolean | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(path: string, cls: string): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', `icon ${cls}`);
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', path);
  el.append(p);
  return el;
}

export const icons = {
  left: (): SVGSVGElement => svg('M16 4 L6 12 L16 20 Z', 'icon-left'),
  right: (): SVGSVGElement => svg('M8 4 L18 12 L8 20 Z', 'icon-right'),
  check: (): SVGSVGElement => svg('M4 12.5 L9.5 18 L20 6.5', 'icon-check'),
  /** Zahnrad für „Einstellungen“. */
  gear: (): SVGSVGElement =>
    svg(
      'M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
      'icon-gear',
    ),
  plus: (): SVGSVGElement => svg('M10.5 4h3v6.5H20v3h-6.5V20h-3v-6.5H4v-3h6.5z', 'icon-plus'),
  minus: (): SVGSVGElement => svg('M4 10.5h16v3H4z', 'icon-minus'),
  /** Funkelstern (✦): Kurzfassung von der KI (SPEC §6). Kein Tippziel. */
  spark: (): SVGSVGElement =>
    svg(
      'M12 1.5c.9 5.8 4.7 9.6 10.5 10.5-5.8.9-9.6 4.7-10.5 10.5C11.1 16.7 7.3 12.9 1.5 12 7.3 11.1 11.1 7.3 12 1.5z',
      'spark',
    ),
};

export type IconName = keyof typeof icons;

/** Taste mit Symbol und Wort [R20]. */
export function button(label: string, icon: IconName, extraClass = ''): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `btn ${extraClass}`.trim() });
  setButton(b, label, icon);
  return b;
}

export function setButton(
  b: HTMLButtonElement,
  label: string,
  icon: IconName,
  options: { inactive?: boolean; sub?: string; selected?: boolean } = {},
): void {
  const text = h('span', { class: 'btn-label' }, label);
  // Nur „▸“ steht hinter dem Wort, alle anderen Symbole davor.
  const content: Node[] =
    icon !== 'right'
      ? [icons[icon](), text]
      : [
          h(
            'span',
            { class: 'btn-text' },
            text,
            options.sub ? h('span', { class: 'btn-sub' }, options.sub) : null,
          ),
          icons.right(),
        ];
  b.replaceChildren(...content);
  b.setAttribute('aria-label', options.sub ? `${label}: ${options.sub}` : label);
  if (options.selected !== undefined) {
    b.setAttribute('aria-pressed', String(options.selected));
    b.classList.toggle('selected', options.selected);
  }
  if (options.inactive) {
    b.setAttribute('aria-disabled', 'true');
    b.classList.add('inactive');
  } else {
    b.removeAttribute('aria-disabled');
    b.classList.remove('inactive');
  }
}

/**
 * Runder Knopf (Auftrag 006): Kreis mit Symbol, das Wort darunter (SPEC §8.1: Symbol + Wort).
 * Das ganze Element ist die Tippfläche.
 */
export function roundButton(label: string, extraClass = ''): HTMLButtonElement {
  return h(
    'button',
    { type: 'button', class: `btn-round ${extraClass}`.trim(), 'aria-label': label },
    h('span', { class: 'round' }, icons.left()),
    h('span', { class: 'round-label' }, label),
  );
}

/** Unsichtbarer Messbehälter mit Größe und Klassen eines echten Bereichs. */
export function measureBox(like: HTMLElement): HTMLElement {
  const box = h('div', { class: `${like.className} measure`, 'aria-hidden': 'true' });
  box.style.width = `${like.clientWidth}px`;
  box.style.height = `${like.clientHeight}px`;
  document.body.append(box);
  return box;
}

export const fitsIn = (box: HTMLElement): boolean => box.scrollHeight <= box.clientHeight + 0.5;

/**
 * Seitenangabe („Seite 2 von 8“, „Stufe 3 von 7“) nie umbrechen: Passt sie nicht in die Leiste,
 * steht dort die Kurzform „2 / 8“; die Langform bleibt für Screenreader (Auftrag 004, A1).
 */
export function fitPageInfo(el: HTMLElement): void {
  // Steht noch die eigene Kurzform da, gilt die Langform aus dem aria-label; sonst der neue Text.
  const text = el.textContent ?? '';
  const full = text === el.dataset.short ? (el.getAttribute('aria-label') ?? text) : text;
  el.textContent = full;
  el.style.removeProperty('font-size');
  el.removeAttribute('aria-label');
  delete el.dataset.short;
  if (!el.isConnected || el.scrollWidth <= el.clientWidth + 1) return;
  const [page, total] = full.match(/\d+/g) ?? [];
  if (page === undefined || total === undefined) return;
  el.setAttribute('aria-label', full);
  el.textContent = t('pager.short', { page, total });
  el.dataset.short = el.textContent;
  // Passt auch die Kurzform nicht, wird sie kleiner (nie unter 18 pt) statt abgeschnitten.
  el.style.removeProperty('font-size');
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (size > MIN_HINT_PX && el.scrollWidth > el.clientWidth + 1) {
    size = Math.max(MIN_HINT_PX, Math.floor(size * 0.9));
    el.style.fontSize = `${size}px`;
  }
}

/** Kleinste Schrift für Anleitungen auf Einstellungs- und Einführungsseiten: 18 pt (SPEC §7). */
const MIN_HINT_PX = 24;

/**
 * Passt eine Seite der Einstellungen oder Einführung bei großer Schrift nicht, werden nur die
 * Anleitungstexte schrittweise kleiner (Auftrag 004, A1) – nicht Vorschau, Titel oder Tasten.
 */
export function fitFlowPage(page: HTMLElement): void {
  page.style.removeProperty('--hint-fit');
  const hints = Array.from(page.querySelectorAll<HTMLElement>('.flowhint'));
  for (const el of hints) el.hidden = false;
  const first = hints[0];
  if (!first || !overflows(page)) return;
  let size = parseFloat(getComputedStyle(first).fontSize);
  while (size > MIN_HINT_PX && overflows(page)) {
    size = Math.max(MIN_HINT_PX, Math.floor(size * 0.9));
    page.style.setProperty('--hint-fit', `${size}px`);
  }
  // Letzte Stufe: reine Bedienhinweise weglassen; die Tasten sagen, was zu tun ist.
  for (const el of hints.filter((e) => e.classList.contains('optional'))) {
    if (!overflows(page)) break;
    el.hidden = true;
  }
}

/** Genau messen: auch ein Bruchteil eines Pixels Überlauf rückt Tasten zu nah an die Leiste. */
function overflows(page: HTMLElement): boolean {
  if (page.scrollHeight > page.clientHeight) return true;
  const outside = (box: Element, children: Element[]): boolean => {
    const bottom = box.getBoundingClientRect().bottom;
    return children.some((c) => c.getBoundingClientRect().bottom > bottom + 0.01);
  };
  if (outside(page, Array.from(page.children))) return true;
  // Auch Karten in einem schrumpfenden Kartenbereich (Übungs-Übersicht der Einführung).
  return Array.from(page.querySelectorAll('.cards')).some((c) =>
    outside(c, Array.from(c.children)),
  );
}

/**
 * Breite der seitlichen Spalten (Auftrag 005): einmal je Bildschirm so breit wie die breiteste
 * Taste in fetter Schrift, links und rechts gleich. Danach ändert sie sich beim Blättern nicht
 * mehr, sodass der Seitenumbruch stimmt.
 */
export function fitSides(screen: HTMLElement): void {
  if (!screen.matches('.screen.article, .screen.overview')) return;
  screen.style.removeProperty('--side-l');
  screen.style.removeProperty('--side-r');
  const screenBox = screen.getBoundingClientRect();
  // Breite je Seite einschließlich Randabstand (margin bzw. padding der Spalte „rail“).
  const measure = (mode: 'sizing-min' | 'sizing-max'): { l: number; r: number } => {
    screen.classList.add('sizing', mode);
    const sides = { l: 0, r: 0 };
    for (const el of screen.querySelectorAll<HTMLElement>('.rail > *, .bar > *')) {
      if (el.classList.contains('pageinfo') || el.classList.contains('btn-next-article')) continue;
      const s = getComputedStyle(el);
      const rail = el.parentElement?.classList.contains('rail')
        ? parseFloat(getComputedStyle(el.parentElement).paddingLeft)
        : 0;
      const r = el.getBoundingClientRect();
      const width = r.width + parseFloat(s.marginLeft) + parseFloat(s.marginRight) + rail;
      const side = r.left + r.width / 2 < screenBox.left + screenBox.width / 2 ? 'l' : 'r';
      sides[side] = Math.max(sides[side], width);
    }
    screen.classList.remove('sizing', mode);
    return sides;
  };
  const min = measure('sizing-min');
  const max = measure('sizing-max');
  // Höchstens 22 % der Breite je Seite – außer das längste Wort braucht mehr.
  const cap = screenBox.width * 0.22;
  const sides = {
    l: Math.max(min.l, Math.min(max.l, cap)),
    r: Math.max(min.r, Math.min(max.r, cap)),
  };
  // Die Seitenangabe soll als „Seite 88 von 88“ in die rechte Spalte passen (Langform), sonst Kurzform.
  const info = screen.querySelector<HTMLElement>('.bar > .pageinfo');
  if (info) {
    const probe = h('span', {}, t('pager.pageOf', { page: 88, total: 88 }));
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
    info.append(probe);
    const margin = parseFloat(getComputedStyle(info).marginRight) || 0;
    sides.r = Math.max(sides.r, Math.min(cap, probe.getBoundingClientRect().width + margin + 2));
    probe.remove();
  }
  if (sides.l > 0) screen.style.setProperty('--side-l', `${Math.ceil(sides.l)}px`);
  if (sides.r > 0) screen.style.setProperty('--side-r', `${Math.ceil(sides.r)}px`);
}
