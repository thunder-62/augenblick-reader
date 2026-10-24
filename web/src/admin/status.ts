import { h } from '../dom.ts';
import { t, tOr } from '../i18n.ts';
import { api } from './api.ts';
import { btn, formatBytes, formatDateTime, section } from './ui.ts';

export async function statusView(root: HTMLElement): Promise<void> {
  const s = await api.status();
  const row = (label: string, value: string): HTMLElement =>
    h('div', { class: 'row' }, h('dt', {}, label), h('dd', {}, value));
  const sources = s.sources.length
    ? h(
        'table',
        {},
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ...['source', 'lastAttempt', 'lastSuccess', 'lastError'].map((k) =>
              h('th', {}, t(`admin.status.${k}`)),
            ),
          ),
        ),
        h(
          'tbody',
          {},
          ...s.sources.map((src) =>
            h(
              'tr',
              { class: src.lastError ? 'has-error' : '' },
              h('td', {}, tOr(`sources.${src.source}`, 'sources.demo')),
              h('td', {}, formatDateTime(src.lastAttemptAt)),
              h('td', {}, formatDateTime(src.lastSuccessAt)),
              h('td', {}, src.lastError ?? '–'),
            ),
          ),
        ),
      )
    : h('p', {}, t('admin.status.noSources'));

  root.replaceChildren(
    section(
      t('admin.tabs.status'),
      h(
        'dl',
        { class: 'facts' },
        row(t('admin.status.version'), s.version),
        row(
          t('admin.status.edition'),
          s.edition.day
            ? t('admin.status.editionValue', {
                day: s.edition.day,
                count: s.edition.articles,
                time: formatDateTime(s.edition.updatedAt),
              })
            : t('admin.status.noEdition'),
        ),
        row(t('admin.status.articles'), t('admin.status.articlesValue', s.articles)),
        row(
          t('admin.status.storage'),
          t('admin.status.storageValue', {
            db: formatBytes(s.storage.dbBytes),
            free: formatBytes(s.storage.freeBytes),
          }),
        ),
        row(t('admin.status.calibrated'), formatDateTime(s.calibratedAt)),
      ),
      btn(t('admin.status.refresh'), () => void statusView(root)),
    ),
    section(t('admin.status.sources'), sources),
    h('p', { class: 'hint' }, t('admin.status.summaryHint')),
  );
}
