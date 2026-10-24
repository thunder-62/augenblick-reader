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
              h('th', {}, t(`technik.status.${k}`)),
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
    : h('p', {}, t('technik.status.noSources'));

  root.replaceChildren(
    section(
      t('technik.tabs.status'),
      h(
        'dl',
        { class: 'facts' },
        row(t('technik.status.version'), s.version),
        row(
          t('technik.status.edition'),
          s.edition.day
            ? t('technik.status.editionValue', {
                day: s.edition.day,
                count: s.edition.articles,
                time: formatDateTime(s.edition.updatedAt),
              })
            : t('technik.status.noEdition'),
        ),
        row(t('technik.status.articles'), t('technik.status.articlesValue', s.articles)),
        row(
          t('technik.status.storage'),
          t('technik.status.storageValue', {
            db: formatBytes(s.storage.dbBytes),
            free: formatBytes(s.storage.freeBytes),
          }),
        ),
        row(t('technik.status.calibrated'), formatDateTime(s.calibratedAt)),
        row(
          t('technik.status.intro'),
          t(`technik.status.introValue.${s.intro.state}`, { step: s.intro.step }),
        ),
      ),
      btn(t('technik.common.refresh'), () => void statusView(root)),
    ),
    section(
      t('technik.status.ai'),
      h(
        'dl',
        { class: 'facts' },
        row(
          t('technik.status.aiProvider'),
          s.ai.provider ? `${s.ai.provider} · ${s.ai.model ?? ''}` : t('technik.status.aiOff'),
        ),
        s.ai.fallbackModel
          ? row('', t('technik.status.aiFallback', { model: s.ai.fallbackModel }))
          : null,
        row(
          t('technik.status.aiToday'),
          t('technik.status.aiTodayValue', {
            calls: s.ai.today.calls,
            limit: s.ai.dailyLimit,
            failures: s.ai.today.failures,
            input: s.ai.today.inputTokens,
            output: s.ai.today.outputTokens,
            cost: new Intl.NumberFormat('de-DE', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 4,
            }).format(s.ai.today.costUsd),
          }),
        ),
        row(
          t('technik.status.aiEdition'),
          t('technik.status.aiEditionValue', { ai: s.ai.editionWithAi, total: s.edition.articles }),
        ),
      ),
    ),
    section(t('technik.status.sources'), sources),
  );
}
