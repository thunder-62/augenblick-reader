/** Interessen (SPEC §5.3, §10): nur die gelernten Themen-Gewichte, kein Leseprotokoll. */
import { h } from '../dom.ts';
import { t } from '../i18n.ts';
import { api } from './api.ts';
import { section } from './ui.ts';

export async function interestsView(root: HTMLElement): Promise<void> {
  const { enabled, interests } = await api.interests();
  const fmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  root.replaceChildren(
    section(
      t('technik.tabs.interests'),
      h('p', { class: 'hint' }, t('technik.interests.intro')),
      h(
        'p',
        {},
        `${t('technik.interests.enabled')}: `,
        t(
          enabled === true
            ? 'technik.interests.on'
            : enabled === false
              ? 'technik.interests.off'
              : 'technik.interests.unset',
        ),
      ),
      interests.length
        ? h(
            'table',
            {},
            h(
              'thead',
              {},
              h(
                'tr',
                {},
                h('th', {}, t('technik.interests.topic')),
                h('th', {}, t('technik.interests.weight')),
              ),
            ),
            h(
              'tbody',
              {},
              ...interests.map((i) =>
                h('tr', {}, h('td', {}, i.topic), h('td', { class: 'num' }, fmt.format(i.weight))),
              ),
            ),
          )
        : h('p', {}, t('technik.interests.empty')),
    ),
  );
}
