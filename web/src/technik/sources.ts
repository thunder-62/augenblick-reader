/** Quellen und Rubriken-Mix (SPEC §5.2, §10). */
import { FEED_CATALOG, MAX_EDITION_ARTICLES, type SectionQuota } from '@augenblick/shared';
import { h } from '../dom.ts';
import { t } from '../i18n.ts';
import { api } from './api.ts';
import { btn, checkbox, field, section, statusLine } from './ui.ts';

export async function sourcesView(root: HTMLElement): Promise<void> {
  const [sources, { current: settings }] = await Promise.all([api.sources(), api.settings()]);

  // RSS-Feeds (ADR 010): Katalog zum Ankreuzen, eigene Adressen zeilenweise
  const active = new Set(sources.feeds);
  const boxes = FEED_CATALOG.map((f) => {
    const box = checkbox('feed', active.has(f.id));
    box.value = f.id;
    const state = f.checked
      ? t('technik.sources.checkedOn', { date: f.checked })
      : t('technik.sources.unchecked');
    return {
      box,
      el: h(
        'label',
        { class: 'check' },
        box,
        h('span', {}, `${f.name} `, h('small', {}, `(${state})`)),
      ),
    };
  });
  const custom = h('textarea', {
    name: 'customFeeds',
    rows: 3,
    spellcheck: false,
    placeholder: 'https://…',
  });
  custom.value = sources.feeds.filter((k) => !FEED_CATALOG.some((f) => f.id === k)).join('\n');
  const feedStatus = statusLine();
  const feedForm = h(
    'form',
    {},
    h('p', { class: 'hint' }, t('technik.sources.feedsHint')),
    ...boxes.map((b) => b.el),
    field(t('technik.sources.custom'), custom, t('technik.sources.customHint')),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'submit', class: 'primary' }, t('technik.common.save')),
    ),
    feedStatus.el,
  );
  feedForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feeds = [
      ...boxes.filter((b) => b.box.checked).map((b) => b.box.value),
      ...custom.value.split(/\s+/).filter(Boolean),
    ];
    try {
      const saved = await api.saveSources({ feeds });
      for (const b of boxes) b.box.checked = saved.feeds.includes(b.box.value);
      custom.value = saved.feeds.filter((k) => !FEED_CATALOG.some((f) => f.id === k)).join('\n');
      feedStatus.ok();
    } catch (err) {
      feedStatus.error(err);
    }
  });

  // Rubriken-Mix
  const rows = h('tbody');
  const sum = h('p', { class: 'hint' });
  const mixStatus = statusLine();
  const updateSum = (): void => {
    const total = Array.from(rows.querySelectorAll<HTMLInputElement>('input[name="count"]')).reduce(
      (n, i) => n + (Number(i.value) || 0),
      0,
    );
    sum.textContent = t('technik.sources.sum', { sum: total });
    sum.classList.toggle('warn', total > MAX_EDITION_ARTICLES);
  };
  const addRow = (q: SectionQuota): void => {
    const tr = h(
      'tr',
      {},
      h(
        'td',
        {},
        h('input', { name: 'key', value: q.key, 'aria-label': t('technik.sources.name') }),
      ),
      h(
        'td',
        {},
        h('input', {
          name: 'sections',
          value: q.sections.join(', '),
          'aria-label': t('technik.sources.sectionList'),
        }),
      ),
      h(
        'td',
        {},
        h('input', {
          name: 'count',
          type: 'number',
          min: 0,
          max: MAX_EDITION_ARTICLES,
          value: q.count,
          'aria-label': t('technik.sources.count'),
        }),
      ),
    );
    tr.append(
      h(
        'td',
        {},
        btn(t('technik.sources.remove'), () => (tr.remove(), updateSum()), 'link'),
      ),
    );
    rows.append(tr);
  };
  settings.sections.forEach(addRow);
  updateSum();
  const mixForm = h(
    'form',
    {},
    h('p', { class: 'hint' }, t('technik.sources.sectionsHint')),
    h(
      'table',
      { class: 'mix' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', {}, t('technik.sources.name')),
          h('th', {}, t('technik.sources.sectionList')),
          h('th', {}, t('technik.sources.count')),
          h('th', {}),
        ),
      ),
      rows,
    ),
    sum,
    h(
      'div',
      { class: 'actions' },
      btn(
        t('technik.sources.add'),
        () => (addRow({ key: '', sections: [], count: 1 }), updateSum()),
      ),
      h('button', { type: 'submit', class: 'primary' }, t('technik.common.save')),
    ),
    mixStatus.el,
  );
  mixForm.addEventListener('input', updateSum);
  mixForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sections = Array.from(rows.querySelectorAll('tr')).map((tr) => ({
      key: tr.querySelector<HTMLInputElement>('input[name="key"]')?.value ?? '',
      sections: (tr.querySelector<HTMLInputElement>('input[name="sections"]')?.value ?? '').split(
        ',',
      ),
      count: Number(tr.querySelector<HTMLInputElement>('input[name="count"]')?.value ?? 0),
    }));
    try {
      const saved = await api.saveSetup({ sections });
      rows.replaceChildren();
      saved.sections.forEach(addRow);
      updateSum();
      mixStatus.ok();
    } catch (err) {
      mixStatus.error(err);
    }
  });

  root.replaceChildren(
    section(t('technik.sources.feeds'), feedForm),
    section(t('technik.sources.sections'), mixForm),
  );
}
