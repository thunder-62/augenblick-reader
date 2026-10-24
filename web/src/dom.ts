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
};

/** Taste mit Symbol und Wort [R20]. */
export function button(label: string, icon: 'left' | 'right', extraClass = ''): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `btn ${extraClass}`.trim() });
  setButton(b, label, icon);
  return b;
}

export function setButton(
  b: HTMLButtonElement,
  label: string,
  icon: 'left' | 'right',
  options: { inactive?: boolean; sub?: string } = {},
): void {
  const text = h('span', { class: 'btn-label' }, label);
  const content: Node[] =
    icon === 'left'
      ? [icons.left(), text]
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
