/** Einrichten (SPEC §8.7, §8.8): Anrede wählen, Einführung neu starten. */
import type { Settings } from '@augenblick/shared';
import { h } from '../dom.ts';
import { t } from '../i18n.ts';
import { api } from './api.ts';
import { btn, field, section, select, statusLine } from './ui.ts';

export async function setupView(root: HTMLElement): Promise<void> {
  const { current } = await api.settings();
  const salutation = select('salutation', current.salutation, [
    ['sie', t('technik.setup.sie')],
    ['du', t('technik.setup.du')],
  ]);
  const saved = statusLine();
  const form = h(
    'form',
    {},
    field(t('technik.setup.salutation'), salutation, t('technik.setup.salutationHint')),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'submit', class: 'primary' }, t('technik.common.save')),
    ),
    saved.el,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.saveSetup({ salutation: salutation.value as Settings['salutation'] });
      saved.ok();
    } catch (err) {
      saved.error(err);
    }
  });

  const introStatus = statusLine();
  root.replaceChildren(
    section(t('technik.setup.salutation'), form),
    section(
      t('technik.setup.intro'),
      h('p', { class: 'hint' }, t('technik.setup.introHint')),
      btn(t('technik.setup.introReset'), async () => {
        try {
          await api.resetIntro();
          introStatus.ok(t('technik.setup.introDone'));
        } catch (err) {
          introStatus.error(err);
        }
      }),
      introStatus.el,
    ),
  );
}
