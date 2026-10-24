/** Spickzettel zum Ausdrucken (A4, Großdruck) mit den drei Tasten [R28]. */
import { h, icons } from '../dom.ts';
import { t } from '../i18n.ts';
import { btn, section } from './ui.ts';

function key(label: string, icon: 'left' | 'right'): HTMLElement {
  const i = icon === 'left' ? icons.left() : icons.right();
  return h('span', { class: 'sheet-key' }, ...(icon === 'left' ? [i, label] : [label, i]));
}

export function cheatsheetView(root: HTMLElement): void {
  const item = (keyEl: HTMLElement, text: string): HTMLElement =>
    h('li', {}, keyEl, h('span', {}, text));
  const sheet = h(
    'article',
    { class: 'sheet' },
    h('h1', {}, t('admin.cheatsheet.title')),
    h(
      'ol',
      {},
      item(
        h('span', { class: 'sheet-card' }, t('admin.cheatsheet.card')),
        t('admin.cheatsheet.cardText'),
      ),
      item(key(t('admin.cheatsheet.next'), 'right'), t('admin.cheatsheet.nextText')),
      item(key(t('admin.cheatsheet.back'), 'left'), t('admin.cheatsheet.backText')),
      item(key(t('admin.cheatsheet.overview'), 'left'), t('admin.cheatsheet.overviewText')),
    ),
    h('p', {}, t('admin.cheatsheet.calm')),
  );
  root.replaceChildren(
    section(
      t('admin.tabs.cheatsheet'),
      h('p', { class: 'hint no-print' }, t('admin.cheatsheet.hint')),
      btn(t('admin.cheatsheet.print'), () => window.print(), 'primary no-print'),
    ),
    sheet,
  );
}
