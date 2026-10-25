/** Spickzettel zum Ausdrucken (A4, Großdruck) mit den Tasten und dem Funkelstern [R28], SPEC §8.8. */
import { h, icons, type IconName } from '../dom.ts';
import { setLocale, t } from '../i18n.ts';
import { api } from './api.ts';
import { btn, section } from './ui.ts';

function key(label: string, icon: IconName): HTMLElement {
  const i = icons[icon]();
  return h('span', { class: 'sheet-key' }, ...(icon === 'right' ? [label, i] : [i, label]));
}

export async function cheatsheetView(root: HTMLElement): Promise<void> {
  // In der Anrede, die beim Einrichten gewählt wurde.
  const { current } = await api.settings();
  setLocale(current.locale, current.salutation);
  const item = (keyEl: HTMLElement, text: string): HTMLElement =>
    h('li', {}, keyEl, h('span', {}, text));
  const sheet = h(
    'article',
    { class: 'sheet' },
    h('h1', {}, t('technik.cheatsheet.title')),
    h(
      'ol',
      {},
      item(
        h('span', { class: 'sheet-card' }, t('technik.cheatsheet.card')),
        t('technik.cheatsheet.cardText'),
      ),
      item(key(t('technik.cheatsheet.next'), 'right'), t('technik.cheatsheet.nextText')),
      item(key(t('technik.cheatsheet.back'), 'left'), t('technik.cheatsheet.backText')),
      item(key(t('technik.cheatsheet.overview'), 'left'), t('technik.cheatsheet.overviewText')),
      item(key(t('technik.cheatsheet.settings'), 'gear'), t('technik.cheatsheet.settingsText')),
      item(h('span', { class: 'sheet-spark' }, icons.spark()), t('technik.cheatsheet.sparkText')),
    ),
    h('p', {}, t('technik.cheatsheet.calm')),
  );
  setLocale(current.locale);
  root.replaceChildren(
    section(
      t('technik.tabs.cheatsheet'),
      h('p', { class: 'hint no-print' }, t('technik.cheatsheet.hint')),
      btn(t('technik.cheatsheet.print'), () => window.print(), 'primary no-print'),
    ),
    sheet,
  );
}
