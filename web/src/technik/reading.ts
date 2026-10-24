/**
 * Leseeinstellungen ansehen, Verlauf, auf eine frühere Fassung zurücksetzen (SPEC §8.7, §10).
 * Hilfe bei Versehen, keine Kontrolle: Ändern kann nur die Leserin selbst.
 */
import type { Settings } from '@augenblick/shared';
import { h } from '../dom.ts';
import { t } from '../i18n.ts';
import { api } from './api.ts';
import { btn, formatDateTime, previewUrl, scaledPreview, section, statusLine } from './ui.ts';

export function valuesText(s: Settings): string {
  return t('technik.reading.valuesText', {
    font: s.fontSizePx,
    theme: t(s.theme === 'dark' ? 'technik.reading.dark' : 'technik.reading.light'),
    lineHeight: new Intl.NumberFormat('de-DE').format(s.lineHeight),
    learning: t(
      s.interestLearning === true
        ? 'technik.reading.learningOn'
        : s.interestLearning === false
          ? 'technik.reading.learningOff'
          : 'technik.reading.learningUnset',
    ),
  });
}

export async function readingView(root: HTMLElement): Promise<void> {
  const { current, baseline, history } = await api.settings();
  const status = statusLine();
  const frame = h('iframe', { title: t('technik.reading.preview'), src: previewUrl({}) });

  const rows = history.map((v) =>
    h(
      'tr',
      {},
      h('td', {}, formatDateTime(v.savedAt)),
      h('td', {}, t(`technik.reading.sources.${v.source}`)),
      h('td', {}, valuesText(v.settings)),
      h(
        'td',
        {},
        btn(t('technik.reading.restore'), async () => {
          // Bestätigung ist hier richtig: der Technik-Bereich ist für den Betreuer.
          if (!confirm(t('technik.reading.restoreConfirm'))) return;
          try {
            await api.restore(v.id);
            await readingView(root);
          } catch (err) {
            status.error(err);
          }
        }),
      ),
    ),
  );

  root.replaceChildren(
    h(
      'div',
      { class: 'split' },
      section(
        t('technik.reading.current'),
        h('p', {}, valuesText(current)),
        h('p', { class: 'hint' }, t('technik.reading.baseline', { values: valuesText(baseline) })),
      ),
      section(t('technik.reading.preview'), scaledPreview(frame)),
    ),
    section(
      t('technik.reading.history'),
      status.el,
      history.length
        ? h(
            'table',
            {},
            h(
              'thead',
              {},
              h(
                'tr',
                {},
                h('th', {}, t('technik.reading.when')),
                h('th', {}, t('technik.reading.source')),
                h('th', {}, t('technik.reading.values')),
                h('th', {}),
              ),
            ),
            h('tbody', {}, ...rows),
          )
        : h('p', {}, t('technik.reading.empty')),
    ),
  );
}
