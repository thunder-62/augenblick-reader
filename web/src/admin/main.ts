import './admin.css';
import { h } from '../dom.ts';
import { t } from '../i18n.ts';
import { api, ApiError } from './api.ts';
import { btn } from './ui.ts';
import { calibrationView } from './calibration.ts';
import { cheatsheetView } from './cheatsheet.ts';
import { settingsView } from './settings.ts';
import { sourcesView } from './sources.ts';
import { statusView } from './status.ts';
import { usageView } from './usage.ts';

type View = (root: HTMLElement) => Promise<void> | void;

const VIEWS: Record<string, View> = {
  status: statusView,
  einstellungen: settingsView,
  kalibrierung: calibrationView,
  quellen: sourcesView,
  nutzung: usageView,
  spickzettel: cheatsheetView,
};
const TAB_LABELS: Record<string, string> = {
  status: 'admin.tabs.status',
  einstellungen: 'admin.tabs.settings',
  kalibrierung: 'admin.tabs.calibration',
  quellen: 'admin.tabs.sources',
  nutzung: 'admin.tabs.usage',
  spickzettel: 'admin.tabs.cheatsheet',
};

const root = document.getElementById('admin') ?? document.body;

function currentTab(): string {
  const tab = location.hash.replace(/^#\/?/, '');
  return tab in VIEWS ? tab : 'status';
}

async function showLogin(message?: string): Promise<void> {
  const pin = h('input', {
    type: 'password',
    inputmode: 'numeric',
    autocomplete: 'current-password',
    name: 'pin',
    'aria-label': t('admin.login.pin'),
  });
  const msg = h('p', { class: 'statusline error', role: 'alert' }, message ?? '');
  const form = h(
    'form',
    { class: 'login panel' },
    h('h1', {}, t('admin.title')),
    h('label', { class: 'field' }, h('span', { class: 'label' }, t('admin.login.pin')), pin),
    h('button', { type: 'submit', class: 'primary' }, t('admin.login.submit')),
    msg,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.login(pin.value);
      await showApp();
    } catch (err) {
      msg.textContent = loginError(err);
      pin.select();
    }
  });
  root.replaceChildren(form);
  pin.focus();
}

function loginError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return t('admin.login.locked');
    if (err.status === 503) return t('admin.login.noPin');
    if (err.status === 403) return t('admin.login.network');
    if (err.status === 401) return t('admin.login.wrong');
  }
  return t('admin.common.error', { message: err instanceof Error ? err.message : String(err) });
}

async function showApp(): Promise<void> {
  const nav = h('nav', { class: 'tabs' });
  const main = h('main', { class: 'content' });
  const logout = btn(
    t('admin.tabs.logout'),
    async () => {
      await api.logout().catch(() => undefined);
      await showLogin();
    },
    'link',
  );
  root.replaceChildren(
    h('header', { class: 'top' }, h('h1', {}, t('admin.title')), logout),
    nav,
    main,
  );

  const render = async (): Promise<void> => {
    const tab = currentTab();
    nav.replaceChildren(
      ...Object.keys(VIEWS).map((key) =>
        h(
          'a',
          {
            href: `#${key}`,
            class: key === tab ? 'active' : '',
            'aria-current': key === tab ? 'page' : undefined,
          },
          t(TAB_LABELS[key] ?? 'admin.tabs.status'),
        ),
      ),
    );
    main.replaceChildren(h('p', {}, t('admin.common.loading')));
    try {
      await (VIEWS[tab] ?? statusView)(main);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return showLogin();
      main.replaceChildren(h('p', { class: 'statusline error' }, loginError(err)));
    }
  };
  window.onhashchange = () => void render();
  await render();
}

async function start(): Promise<void> {
  try {
    await api.session();
    await showApp();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) await showLogin();
    else await showLogin(loginError(err));
  }
}

void start();
