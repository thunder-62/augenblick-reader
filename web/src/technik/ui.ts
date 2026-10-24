/** Kleine Bausteine für die Formulare des Technik-Bereichs (normale Größen, SPEC §10). */
import { h } from '../dom.ts';
import { t, i18n } from '../i18n.ts';

export function section(title: string, ...children: (Node | null)[]): HTMLElement {
  return h('section', { class: 'panel' }, h('h2', {}, title), ...children);
}

export function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'label' }, label),
    control,
    hint ? h('small', {}, hint) : null,
  );
}

export function numberInput(
  value: number,
  limits: { min: number; max: number; step: number },
  name: string,
): HTMLInputElement {
  return h('input', {
    type: 'number',
    name,
    value: String(value),
    min: limits.min,
    max: limits.max,
    step: limits.step,
    inputmode: 'decimal',
  });
}

export function select(
  name: string,
  value: string,
  options: [string, string][],
): HTMLSelectElement {
  const el = h('select', { name });
  for (const [v, label] of options)
    el.append(h('option', { value: v, selected: v === value }, label));
  return el;
}

export function checkbox(name: string, checked: boolean, disabled = false): HTMLInputElement {
  return h('input', { type: 'checkbox', name, checked, disabled });
}

export function btn(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = h('button', { type: 'button', class: cls }, label);
  b.addEventListener('click', onClick);
  return b;
}

/** Statuszeile unter einem Formular: „Gespeichert.“ oder Fehlertext. */
export function statusLine(): {
  el: HTMLElement;
  ok(text?: string): void;
  error(err: unknown): void;
  info(text: string): void;
} {
  const el = h('p', { class: 'statusline', role: 'status' });
  return {
    el,
    ok: (text = t('technik.common.saved')) => {
      el.className = 'statusline ok';
      el.textContent = text;
    },
    error: (err) => {
      el.className = 'statusline error';
      el.textContent = t('technik.common.error', {
        message: err instanceof Error ? err.message : String(err),
      });
    },
    info: (text) => {
      el.className = 'statusline';
      el.textContent = text;
    },
  };
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return t('technik.common.never');
  return new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function formatBytes(n: number | null): string {
  if (n === null) return '–';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 }).format(v)} ${units[i]}`;
}

/** URL der Lese-App im Vorschau-Modus. */
export function previewUrl(settings: unknown, articleId?: string): string {
  const q = new URLSearchParams({ vorschau: JSON.stringify(settings) });
  if (articleId) q.set('artikel', articleId);
  return `/?${q.toString()}`;
}

/** Vorschau im Format des Tablets (vorläufig 1280×800), verkleinert auf die verfügbare Breite. */
export function scaledPreview(frame: HTMLIFrameElement, width = 1280, height = 800): HTMLElement {
  const box = h('div', { class: 'preview-box' }, frame);
  box.style.aspectRatio = `${width} / ${height}`;
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  new ResizeObserver(() => {
    frame.style.transform = `scale(${box.clientWidth / width})`;
  }).observe(box);
  return box;
}
