/**
 * Einführung „Ausprobieren“ (SPEC §8.8): ein Schritt pro Bildschirm, jeder Schritt überspringbar,
 * kein Zeitlimit, würdevoll und fehlertolerant. Wer geht, macht später an derselben Stelle weiter.
 * Vorlesen (Schritt 6) kommt mit M5; bis dahin hat die Einführung 6 Schritte.
 */
import {
  CALIBRATION_SIZES_PX,
  type IntroState,
  type Settings,
  type Theme,
} from '@augenblick/shared';
import { saveIntro, saveSettings } from './api.ts';
import { h, setButton } from './dom.ts';
import {
  confirmScreen,
  controls,
  flowScreen,
  hint,
  nearestStep,
  sampleBox,
  tapButton,
  type FlowHost,
} from './flow.ts';
import { t } from './i18n.ts';
import { onTap } from './tap.ts';

type Step = 'welcome' | 'font' | 'colors' | 'paging' | 'open' | 'finish';
const STEPS: Step[] = ['welcome', 'font', 'colors', 'paging', 'open', 'finish'];

/** Was in der Einführung gewählt wurde; gespeichert wird erst am Ende nach der Rückfrage. */
type Draft = { fontStep: number | null; theme: Theme | null; consent: boolean | null };

export class IntroFlow {
  private state: IntroState;
  private draft: Draft = { fontStep: null, theme: null, consent: null };

  constructor(
    private readonly host: FlowHost,
    state: IntroState,
  ) {
    this.state = state;
  }

  get intro(): IntroState {
    return this.state;
  }

  menuLabel(): string {
    return this.state.state === 'pausiert'
      ? t('settings.menu.introContinue')
      : t('settings.menu.intro');
  }

  /** Startet bzw. setzt fort (pausiert: an derselben Stelle). */
  start(): void {
    const step = this.state.state === 'pausiert' ? this.state.step : 1;
    this.draft = { fontStep: null, theme: null, consent: null };
    this.go(step);
  }

  private remember(step: number, state: IntroState['state'] = 'pausiert'): void {
    this.state = { state, step };
    void saveIntro(this.state).catch(() => undefined);
  }

  /** Lese-Werte mit dem bisher Gewählten. */
  private draftSettings(): Settings {
    const s = this.host.settings;
    return {
      ...s,
      fontSizePx:
        this.draft.fontStep !== null
          ? (CALIBRATION_SIZES_PX[this.draft.fontStep] ?? s.fontSizePx)
          : s.fontSizePx,
      theme: this.draft.theme ?? s.theme,
    };
  }

  private leave(): HTMLButtonElement {
    // Notausgang: die Einführung pausiert und geht später an derselben Stelle weiter.
    return tapButton(t('nav.overview'), 'left', () => this.host.showOverview(), 'btn-overview');
  }

  private skip(step: number): HTMLButtonElement {
    return tapButton(t('nav.skip'), 'right', () => this.go(step + 1), 'btn-skip');
  }

  private progress(step: number): string {
    return t('intro.progress', { step, total: STEPS.length });
  }

  private go(step: number): void {
    const name = STEPS[step - 1];
    if (!name) return;
    this.remember(step);
    switch (name) {
      case 'welcome':
        return this.welcome(step);
      case 'font':
        return this.font(step, this.draft.fontStep ?? 0);
      case 'colors':
        return this.colors(step, this.draft.theme ?? this.host.settings.theme);
      case 'paging':
        return this.paging(step, 0);
      case 'open':
        return this.openPractice(step, false);
      case 'finish':
        return this.finish(step);
    }
  }

  private welcome(step: number): void {
    const { screen } = flowScreen({
      rail: this.leave(),
      progress: this.progress(step),
      title: t('intro.welcome.title'),
      content: [hint(t('intro.welcome.text'))],
      bar: [
        this.skip(step),
        null,
        tapButton(t('nav.letsGo'), 'right', () => this.go(step + 1), 'btn-next'),
      ],
    });
    this.host.mount(screen);
  }

  private font(step: number, size: number): void {
    const settings = { ...this.draftSettings(), fontSizePx: CALIBRATION_SIZES_PX[size] ?? 24 };
    const sample = sampleBox(settings, [t('settings.sample')]);
    const smaller = tapButton(t('settings.font.smaller'), 'minus', () =>
      this.font(step, Math.max(0, size - 1)),
    );
    const larger = tapButton(t('settings.font.larger'), 'plus', () =>
      this.font(step, Math.min(CALIBRATION_SIZES_PX.length - 1, size + 1)),
    );
    if (size === 0) setButton(smaller, t('settings.font.smaller'), 'minus', { inactive: true });
    if (size === CALIBRATION_SIZES_PX.length - 1)
      setButton(larger, t('settings.font.larger'), 'plus', { inactive: true });
    const done = tapButton(
      t('settings.font.comfortable'),
      'check',
      () => {
        this.draft.fontStep = size;
        this.go(step + 1);
      },
      'btn-next',
    );
    const { screen } = flowScreen({
      rail: this.leave(),
      progress: this.progress(step),
      title: t('settings.menu.font'),
      content: [hint(t('settings.font.hint'), true), sample.el, controls(smaller, larger)],
      bar: [
        this.skip(step),
        h(
          'p',
          { class: 'pageinfo' },
          t('settings.font.step', { step: size + 1, total: CALIBRATION_SIZES_PX.length }),
        ),
        done,
      ],
    });
    this.host.mount(screen);
    sample.fit();
  }

  private colors(step: number, shown: Theme): void {
    const sample = sampleBox({ ...this.draftSettings(), theme: shown }, [t('settings.sample')]);
    const other = tapButton(t('settings.colors.other'), 'right', () =>
      this.colors(step, shown === 'dark' ? 'light' : 'dark'),
    );
    const better = tapButton(
      t('settings.colors.better'),
      'check',
      () => {
        this.draft.theme = shown;
        this.go(step + 1);
      },
      'btn-next',
    );
    const { screen } = flowScreen({
      rail: this.leave(),
      progress: this.progress(step),
      title: t('settings.menu.colors'),
      content: [hint(t('intro.colors.hint'), true), sample.el, controls(other)],
      bar: [this.skip(step), null, better],
    });
    this.host.mount(screen);
    sample.fit();
  }

  /** Blättern üben: ein kurzer Übungstext über zwei Seiten. */
  private paging(step: number, page: 0 | 1): void {
    const sample = sampleBox(this.draftSettings(), [
      t(page === 0 ? 'intro.paging.page1' : 'intro.paging.page2'),
    ]);
    const info = h('p', { class: 'pageinfo' }, t('pager.pageOf', { page: page + 1, total: 2 }));
    const left =
      page === 0
        ? this.skip(step)
        : tapButton(t('nav.back'), 'left', () => this.paging(step, 0), 'btn-back');
    const right =
      page === 0
        ? tapButton(t('nav.next'), 'right', () => this.paging(step, 1), 'btn-next')
        : tapButton(t('nav.nextStep'), 'right', () => this.go(step + 1), 'btn-next');
    const { screen } = flowScreen({
      rail: this.leave(),
      progress: this.progress(step),
      title: t('intro.paging.title'),
      content: [hint(page === 0 ? t('intro.paging.task') : t('intro.done')), sample.el],
      bar: [left, info, right],
    });
    this.host.mount(screen);
    sample.fit();
  }

  /** Artikel öffnen und zurück: Übungs-Übersicht mit zwei Karten. */
  private openPractice(step: number, done: boolean): void {
    const card = (n: 1 | 2): HTMLButtonElement => {
      const b = h(
        'button',
        { type: 'button', class: 'card practice-card' },
        h('span', { class: 'title' }, t(`intro.open.card${n}.title`)),
      );
      onTap(b, () => this.practiceArticle(step, n));
      return b;
    };
    const next = tapButton(t('nav.nextStep'), 'right', () => this.go(step + 1), 'btn-next');
    if (!done) setButton(next, t('nav.nextStep'), 'right', { inactive: true });
    const { screen } = flowScreen({
      // In der Übungs-Übersicht gibt es wie in der echten Übersicht keine „Übersicht“-Taste.
      rail: null,
      progress: this.progress(step),
      title: t('intro.open.title'),
      content: [
        hint(done ? t('intro.done') : t('intro.open.task1')),
        h('div', { class: 'cards practice' }, card(1), card(2)),
      ],
      bar: [this.skip(step), null, next],
      className: 'practice-overview',
    });
    this.host.mount(screen);
  }

  private practiceArticle(step: number, n: 1 | 2): void {
    const sample = sampleBox(this.draftSettings(), [t(`intro.open.card${n}.text`)]);
    const back = tapButton(
      t('nav.overview'),
      'left',
      () => this.openPractice(step, true),
      'btn-overview',
    );
    const { screen } = flowScreen({
      rail: back,
      progress: this.progress(step),
      title: t(`intro.open.card${n}.title`),
      content: [hint(t('intro.open.task2')), sample.el],
      bar: [null, null, null],
    });
    this.host.mount(screen);
    sample.fit();
  }

  /** Fertig: Einverständnis zum Interessen-Lernen, gewählte Werte, zweistufiges Speichern. */
  private finish(step: number): void {
    const yes = tapButton(
      t('interests.yes'),
      'check',
      () => ((this.draft.consent = true), this.finish(step)),
    );
    const no = tapButton(
      t('interests.no'),
      'minus',
      () => ((this.draft.consent = false), this.finish(step)),
    );
    setButton(yes, t('interests.yes'), 'check', { selected: this.draft.consent === true });
    setButton(no, t('interests.no'), 'minus', { selected: this.draft.consent === false });
    const s = this.draftSettings();
    const values = t('intro.finish.values', {
      step: nearestStep(s.fontSizePx) + 1,
      total: CALIBRATION_SIZES_PX.length,
      colors: t(s.theme === 'dark' ? 'intro.finish.dark' : 'intro.finish.light'),
    });
    const save = tapButton(t('nav.save'), 'right', () => this.confirm(), 'btn-next');
    const { screen } = flowScreen({
      rail: this.leave(),
      progress: this.progress(step),
      title: t('intro.finish.title'),
      content: [hint(t('interests.consent')), controls(yes, no), hint(values)],
      // Auch hier „Überspringen“ (SPEC §8.8): beendet die Einführung, ohne etwas zu speichern.
      bar: [tapButton(t('nav.skip'), 'right', () => this.end(), 'btn-skip'), null, save],
    });
    this.host.mount(screen);
  }

  private confirm(): void {
    const change: Partial<Settings> = {};
    if (this.draft.fontStep !== null)
      change.fontSizePx = CALIBRATION_SIZES_PX[this.draft.fontStep] ?? 24;
    if (this.draft.theme) change.theme = this.draft.theme;
    if (this.draft.consent !== null) change.interestLearning = this.draft.consent;
    confirmScreen(this.host, {
      description: t('intro.finish.again'),
      preview: this.draftSettings(),
      onYes: async () => {
        try {
          if (Object.keys(change).length)
            await this.host.applySaved(await saveSettings(change, 'einfuehrung'));
        } catch {
          // nicht erreichbar: es bleibt, wie es war
        }
        this.remember(STEPS.length, 'fertig');
        this.host.showOverview();
      },
      onNo: () => this.end(),
    });
  }

  /** Einführung beenden; was nicht nach der Rückfrage gespeichert wurde, bleibt, wie es war. */
  private end(): void {
    this.remember(STEPS.length, 'fertig');
    this.host.showOverview();
  }
}
