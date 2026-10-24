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

/** Unsichtbarer Messbehälter mit Größe und Klassen eines echten Bereichs. */
export function measureBox(like: HTMLElement): HTMLElement {
  const box = h('div', { class: `${like.className} measure`, 'aria-hidden': 'true' });
  box.style.width = `${like.clientWidth}px`;
  box.style.height = `${like.clientHeight}px`;
  document.body.append(box);
  return box;
}

export const fitsIn = (box: HTMLElement): boolean => box.scrollHeight <= box.clientHeight + 0.5;
