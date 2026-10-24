/** Einstellungen aus SPEC §7 bearbeiten, mit Live-Vorschau der echten Lese-App. */
import { SETTINGS_LIMITS, type Settings } from '@augenblick/shared';
import { h } from '../dom.ts';
import { t } from '../i18n.ts';
import { api } from './api.ts';
import {
  btn,
  checkbox,
  field,
  numberInput,
  previewUrl,
  scaledPreview,
  section,
  select,
  statusLine,
} from './ui.ts';

export async function settingsView(root: HTMLElement): Promise<void> {
  const [{ settings, defaults }, edition] = await Promise.all([api.settings(), api.edition()]);
  const L = SETTINGS_LIMITS;
  const form = h('form', { class: 'settings-form' });
  const status = statusLine();

  const inputs = {
    fontSizePx: numberInput(settings.fontSizePx, L.fontSizePx, 'fontSizePx'),
    lineHeight: numberInput(settings.lineHeight, L.lineHeight, 'lineHeight'),
    wordSpacingEm: numberInput(settings.wordSpacingEm, L.wordSpacingEm, 'wordSpacingEm'),
    letterSpacingEm: numberInput(settings.letterSpacingEm, L.letterSpacingEm, 'letterSpacingEm'),
    maxCharsPerLine: numberInput(settings.maxCharsPerLine, L.maxCharsPerLine, 'maxCharsPerLine'),
    fontFamily: select('fontFamily', settings.fontFamily, [
      ['atkinson', t('admin.settings.fontAtkinson')],
      ['mono', t('admin.settings.fontMono')],
    ]),
    theme: select('theme', settings.theme, [
      ['dark', t('admin.settings.themeDark')],
      ['light', t('admin.settings.themeLight')],
    ]),
  };
  // Vorlesen und Experimente kommen erst mit M5/M6 – sichtbar, aber noch nicht änderbar.
  const later = {
    ttsEnabled: checkbox('ttsEnabled', settings.ttsEnabled, true),
    ttsRate: Object.assign(numberInput(settings.ttsRate, L.ttsRate, 'ttsRate'), { disabled: true }),
    tickerMode: checkbox('tickerMode', settings.tickerMode, true),
    lineFocus: checkbox('lineFocus', settings.lineFocus, true),
    fingerFollow: checkbox('fingerFollow', settings.fingerFollow, true),
  };

  const draft = (): Partial<Settings> => ({
    fontSizePx: Number(inputs.fontSizePx.value),
    lineHeight: Number(inputs.lineHeight.value),
    wordSpacingEm: Number(inputs.wordSpacingEm.value),
    letterSpacingEm: Number(inputs.letterSpacingEm.value),
    maxCharsPerLine: Number(inputs.maxCharsPerLine.value),
    fontFamily: inputs.fontFamily.value as Settings['fontFamily'],
    theme: inputs.theme.value as Settings['theme'],
  });

  const fill = (s: Settings): void => {
    inputs.fontSizePx.value = String(s.fontSizePx);
    inputs.lineHeight.value = String(s.lineHeight);
    inputs.wordSpacingEm.value = String(s.wordSpacingEm);
    inputs.letterSpacingEm.value = String(s.letterSpacingEm);
    inputs.maxCharsPerLine.value = String(s.maxCharsPerLine);
    inputs.fontFamily.value = s.fontFamily;
    inputs.theme.value = s.theme;
  };

  // Vorschau: echte Lese-App im Vorschau-Modus, Änderungen per postMessage ohne Neuladen.
  const articles = edition.articles;
  const target = select('preview', '', [
    ['', t('admin.settings.preview')],
    ...articles
      .slice(0, 12)
      .map((a): [string, string] => [a.id, `${t('admin.settings.previewArticle')}: ${a.title}`]),
  ]);
  const frame = h('iframe', {
    class: 'preview-frame',
    title: t('admin.settings.preview'),
    src: previewUrl(draft()),
  });
  const push = (): void => {
    frame.contentWindow?.postMessage(
      { type: 'augenblick-preview', settings: draft() },
      location.origin,
    );
    status.info(t('admin.common.unsaved'));
  };
  // Die Vorschau meldet sich, sobald sie Nachrichten annehmen kann; dann den aktuellen Entwurf schicken.
  const onReady = (e: MessageEvent<unknown>): void => {
    if (!frame.isConnected) return window.removeEventListener('message', onReady);
    if (
      e.origin === location.origin &&
      (e.data as { type?: string })?.type === 'augenblick-preview-ready'
    ) {
      frame.contentWindow?.postMessage(
        { type: 'augenblick-preview', settings: draft() },
        location.origin,
      );
    }
  };
  window.addEventListener('message', onReady);
  target.addEventListener('change', () => {
    frame.src = previewUrl(draft(), target.value || undefined);
  });
  form.addEventListener('input', push);
  form.addEventListener('change', push);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      fill(await api.saveSettings(draft()));
      status.ok();
    } catch (err) {
      status.error(err);
    }
  });

  form.append(
    h('p', { class: 'hint' }, t('admin.settings.intro')),
    h(
      'fieldset',
      {},
      h('legend', {}, t('admin.settings.reading')),
      field(
        t('admin.settings.fontSizePx'),
        inputs.fontSizePx,
        `${L.fontSizePx.min}–${L.fontSizePx.max}`,
      ),
      field(
        t('admin.settings.lineHeight'),
        inputs.lineHeight,
        `${L.lineHeight.min}–${L.lineHeight.max}`,
      ),
      field(
        t('admin.settings.wordSpacingEm'),
        inputs.wordSpacingEm,
        `${L.wordSpacingEm.min}–${L.wordSpacingEm.max}`,
      ),
      field(
        t('admin.settings.letterSpacingEm'),
        inputs.letterSpacingEm,
        `${L.letterSpacingEm.min}–${L.letterSpacingEm.max}`,
      ),
      field(t('admin.settings.fontFamily'), inputs.fontFamily),
      field(t('admin.settings.theme'), inputs.theme),
      field(
        t('admin.settings.maxCharsPerLine'),
        inputs.maxCharsPerLine,
        `${L.maxCharsPerLine.min}–${L.maxCharsPerLine.max}`,
      ),
    ),
    h(
      'fieldset',
      { class: 'later' },
      h('legend', {}, t('admin.settings.tts')),
      field(t('admin.settings.ttsEnabled'), later.ttsEnabled),
      field(t('admin.settings.ttsRate'), later.ttsRate),
    ),
    h(
      'fieldset',
      { class: 'later' },
      h('legend', {}, t('admin.settings.experiments')),
      field(t('admin.settings.tickerMode'), later.tickerMode),
      field(t('admin.settings.lineFocus'), later.lineFocus),
      field(t('admin.settings.fingerFollow'), later.fingerFollow),
    ),
    h('p', { class: 'hint' }, `${t('admin.settings.language')}: ${t('admin.settings.locale')}`),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'submit', class: 'primary' }, t('admin.common.save')),
      btn(t('admin.common.defaults'), () => {
        fill(defaults);
        push();
      }),
    ),
    status.el,
  );

  root.replaceChildren(
    h(
      'div',
      { class: 'split' },
      section(t('admin.tabs.settings'), form),
      section(t('admin.settings.preview'), target, scaledPreview(frame)),
    ),
  );
}
