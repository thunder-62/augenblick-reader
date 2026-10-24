/** Nutzungsprotokoll (SPEC §10): nur lokal, abschaltbar. */
import { h } from '../dom.ts';
import { t } from '../i18n.ts';
import { api } from './api.ts';
import { btn, section, statusLine } from './ui.ts';

export async function usageView(root: HTMLElement): Promise<void> {
  const usage = await api.usage();
  const status = statusLine();
  const toggle = h('input', { type: 'checkbox', checked: usage.enabled, name: 'usageLogEnabled' });
  toggle.addEventListener('change', async () => {
    try {
      await api.saveSources({ usageLogEnabled: toggle.checked });
      status.ok();
    } catch (err) {
      status.error(err);
    }
  });
  const table = usage.days.length
    ? h(
        'table',
        {},
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ...['day', 'articles', 'pages', 'minutes'].map((k) =>
              h('th', {}, t(`admin.usage.${k}`)),
            ),
          ),
        ),
        h(
          'tbody',
          {},
          ...usage.days.map((d) =>
            h(
              'tr',
              {},
              h(
                'td',
                {},
                new Intl.DateTimeFormat('de-DE', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                }).format(new Date(`${d.day}T12:00:00`)),
              ),
              h('td', { class: 'num' }, String(d.articles)),
              h('td', { class: 'num' }, String(d.pages)),
              h('td', { class: 'num' }, String(d.minutes)),
            ),
          ),
        ),
      )
    : h('p', {}, t('admin.usage.empty'));

  root.replaceChildren(
    section(
      t('admin.tabs.usage'),
      h('p', { class: 'hint' }, t('admin.usage.intro')),
      h('label', { class: 'check' }, toggle, t('admin.usage.enabled')),
      status.el,
      table,
      btn(
        t('admin.usage.delete'),
        async () => {
          // Bestätigung ist hier richtig: der Admin-Bereich ist für den Betreuer, nicht für die Nutzerin.
          if (!confirm(t('admin.usage.confirmDelete'))) return;
          await api.deleteUsage();
          await usageView(root);
        },
        'danger',
      ),
    ),
  );
}
