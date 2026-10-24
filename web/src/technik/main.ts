import './technik.css';
import { h } from '../dom.ts';
import { t } from '../i18n.ts';
import { ApiError } from './api.ts';
import { cheatsheetView } from './cheatsheet.ts';
import { interestsView } from './interests.ts';
import { readingView } from './reading.ts';
import { setupView } from './setup.ts';
import { sourcesView } from './sources.ts';
import { statusView } from './status.ts';

type View = (root: HTMLElement) => Promise<void> | void;

const VIEWS: Record<string, [label: string, view: View]> = {
  status: ['technik.tabs.status', statusView],
  lesen: ['technik.tabs.reading', readingView],
  quellen: ['technik.tabs.sources', sourcesView],
  interessen: ['technik.tabs.interests', interestsView],
  einrichten: ['technik.tabs.setup', setupView],
  spickzettel: ['technik.tabs.cheatsheet', cheatsheetView],
};

const root = document.getElementById('technik') ?? document.body;

function currentTab(): string {
  const tab = location.hash.replace(/^#\/?/, '');
  return tab in VIEWS ? tab : 'status';
}

async function render(): Promise<void> {
  const tab = currentTab();
  const nav = h(
    'nav',
    { class: 'tabs' },
    ...Object.entries(VIEWS).map(([key, [label]]) =>
      h(
        'a',
        {
          href: `#${key}`,
          class: key === tab ? 'active' : '',
          'aria-current': key === tab ? 'page' : undefined,
        },
        t(label),
      ),
    ),
  );
  const main = h('main', { class: 'content' }, h('p', {}, t('technik.common.loading')));
  root.replaceChildren(
    h(
      'header',
      { class: 'top' },
      h('h1', {}, t('technik.title')),
      h('p', { class: 'hint' }, t('technik.intro')),
    ),
    nav,
    main,
  );
  try {
    await (VIEWS[tab]?.[1] ?? statusView)(main);
  } catch (err) {
    const message = err instanceof ApiError || err instanceof Error ? err.message : String(err);
    main.replaceChildren(
      h('p', { class: 'statusline error' }, t('technik.common.error', { message })),
    );
  }
}

window.onhashchange = () => void render();
void render();
