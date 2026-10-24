/**
 * Kalibrierung (SPEC §8.4): auf dem Tablet, gemeinsam mit der Nutzerin.
 * 1. Schriftgröße in Stufen von ca. +26 % ab 18 pt, 2. Farbschema hell/dunkel mit optionaler
 * Lesezeit, 3. Vorschau einer echten Artikelseite, dann speichern.
 */
import {
  CALIBRATION_SIZES_PX,
  MIN_FONT_SIZE_PX,
  THEMES,
  type Settings,
  type Theme,
} from '@augenblick/shared';
import { h } from '../dom.ts';
import { t } from '../i18n.ts';
import { api } from './api.ts';
import { btn, formatDateTime, previewUrl, section } from './ui.ts';

const FONT = "'Atkinson Hyperlegible', Verdana, sans-serif";

export async function calibrationView(root: HTMLElement): Promise<void> {
  const [{ settings }, status] = await Promise.all([api.settings(), api.status()]);
  root.replaceChildren(
    section(
      t('admin.tabs.calibration'),
      h('p', {}, t('admin.calibration.intro')),
      h(
        'p',
        { class: 'hint' },
        t('admin.calibration.last', { date: formatDateTime(status.calibratedAt) }),
      ),
      btn(
        t('admin.calibration.start'),
        () => void runCalibration(settings, () => void calibrationView(root)),
        'primary',
      ),
    ),
  );
}

async function runCalibration(settings: Settings, onClose: () => void): Promise<void> {
  const overlay = h('div', {
    class: 'calib',
    role: 'dialog',
    'aria-label': t('admin.tabs.calibration'),
  });
  const stage = h('div', { class: 'calib-stage' });
  const head = h('div', { class: 'calib-head' });
  const bar = h('div', { class: 'calib-bar' });
  overlay.append(head, stage, bar);
  document.body.append(overlay);
  document.documentElement.requestFullscreen?.().catch(() => undefined);

  const close = (): void => {
    overlay.remove();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onClose();
  };

  // Lesetext in den Werten der Lese-App, nur Größe und Schema wechseln.
  const paint = (el: HTMLElement, px: number, theme: Theme): void => {
    const c = THEMES[theme];
    Object.assign(el.style, {
      background: c.bg,
      color: c.text,
      fontFamily: FONT,
      fontSize: `${px}px`,
      lineHeight: String(settings.lineHeight),
      wordSpacing: `${settings.wordSpacingEm}em`,
      letterSpacing: `${settings.letterSpacingEm}em`,
    });
  };

  let step = 0; // Schriftstufe (0 = 18 pt; beginnt bewusst klein)
  let oneUp = false;
  let chosenPx = settings.fontSizePx;
  let theme: Theme = settings.theme;
  const times: Partial<Record<Theme, number>> = {};

  const sizeStep = (): void => {
    const px = CALIBRATION_SIZES_PX[step] ?? MIN_FONT_SIZE_PX;
    head.replaceChildren(
      h('h2', {}, t('admin.calibration.step1')),
      h('p', {}, t('admin.calibration.step1Hint')),
    );
    const text = h('p', { class: 'calib-text' }, t('admin.calibration.sample'));
    paint(stage, px, theme);
    stage.replaceChildren(text);
    const up = h('input', { type: 'checkbox', checked: oneUp });
    up.addEventListener('change', () => (oneUp = up.checked));
    bar.replaceChildren(
      h(
        'span',
        { class: 'calib-info' },
        t('admin.calibration.sizeOf', { step: step + 1, total: CALIBRATION_SIZES_PX.length, px }),
      ),
      Object.assign(
        btn(
          `◂ ${t('admin.calibration.smaller')}`,
          () => ((step = Math.max(0, step - 1)), sizeStep()),
        ),
        {
          disabled: step === 0,
        },
      ),
      Object.assign(
        btn(
          `${t('admin.calibration.larger')} ▸`,
          () => ((step = Math.min(CALIBRATION_SIZES_PX.length - 1, step + 1)), sizeStep()),
        ),
        { disabled: step === CALIBRATION_SIZES_PX.length - 1 },
      ),
      h('label', { class: 'calib-check' }, up, t('admin.calibration.oneUp')),
      btn(
        `✓ ${t('admin.calibration.comfortable')}`,
        () => {
          const i = Math.min(CALIBRATION_SIZES_PX.length - 1, step + (oneUp ? 1 : 0));
          chosenPx = CALIBRATION_SIZES_PX[i] ?? px;
          themeStep();
        },
        'primary',
      ),
      btn(t('admin.calibration.close'), close, 'link'),
    );
  };

  let timerStart: number | null = null;
  const themeStep = (): void => {
    head.replaceChildren(
      h('h2', {}, t('admin.calibration.step2')),
      h('p', {}, t('admin.calibration.step2Hint')),
    );
    paint(stage, chosenPx, theme);
    stage.replaceChildren(h('p', { class: 'calib-text' }, t('admin.calibration.paragraph')));
    const timeText = (th: Theme): string =>
      times[th] !== undefined
        ? ` (${t('admin.calibration.time', { seconds: times[th] ?? 0 })})`
        : '';
    const timer = btn(
      timerStart === null
        ? `⏱ ${t('admin.calibration.timerStart')}`
        : `■ ${t('admin.calibration.timerStop')}`,
      () => {
        if (timerStart === null) timerStart = performance.now();
        else {
          times[theme] = Math.round((performance.now() - timerStart) / 1000);
          timerStart = null;
        }
        themeStep();
      },
    );
    bar.replaceChildren(
      btn(`◂ ${t('admin.calibration.back')}`, () => ((timerStart = null), sizeStep())),
      btn(
        t('admin.calibration.showLight') + timeText('light'),
        () => ((theme = 'light'), (timerStart = null), themeStep()),
        theme === 'light' ? 'active' : '',
      ),
      btn(
        t('admin.calibration.showDark') + timeText('dark'),
        () => ((theme = 'dark'), (timerStart = null), themeStep()),
        theme === 'dark' ? 'active' : '',
      ),
      timer,
      btn(
        `✓ ${t('admin.calibration.takeLight')}`,
        () => ((theme = 'light'), void previewStep()),
        'primary',
      ),
      btn(
        `✓ ${t('admin.calibration.takeDark')}`,
        () => ((theme = 'dark'), void previewStep()),
        'primary',
      ),
    );
  };

  const previewStep = async (): Promise<void> => {
    const edition = await api.edition().catch(() => null);
    const first = edition?.articles[0]?.id;
    head.replaceChildren(
      h('h2', {}, t('admin.calibration.step3')),
      h(
        'p',
        {},
        t('admin.calibration.step3Hint', {
          px: chosenPx,
          theme: t(theme === 'dark' ? 'admin.settings.themeDark' : 'admin.settings.themeLight'),
        }),
      ),
    );
    stage.removeAttribute('style');
    const frame = h('iframe', {
      class: 'calib-frame',
      title: t('admin.calibration.step3'),
      src: previewUrl({ ...settings, fontSizePx: chosenPx, theme }, first),
    });
    stage.replaceChildren(frame);
    const msg = h('span', { class: 'calib-info', role: 'status' });
    bar.replaceChildren(
      btn(`◂ ${t('admin.calibration.back')}`, themeStep),
      btn(
        `✓ ${t('admin.calibration.save')}`,
        async () => {
          try {
            await api.calibrate(chosenPx, theme);
            msg.textContent = t('admin.calibration.done');
            bar.replaceChildren(msg, btn(t('admin.calibration.close'), close, 'primary'));
          } catch (err) {
            msg.textContent = t('admin.common.error', {
              message: err instanceof Error ? err.message : String(err),
            });
          }
        },
        'primary',
      ),
      msg,
    );
  };

  sizeStep();
}
