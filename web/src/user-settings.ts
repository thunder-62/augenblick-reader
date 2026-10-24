/**
 * Einstellungen der Nutzerin (SPEC §8.7): Autonomie vor Schutz. Jede Änderung wirkt sofort auf eine
 * Vorschau; dauerhaft gespeichert wird erst nach „Ja, so lassen“. Wer vorher geht, behält das Alte.
 */
import { CALIBRATION_SIZES_PX, type Interest, type Settings } from '@augenblick/shared';
import { fetchBaseline, fetchInterests, saveInterests, saveSettings } from './api.ts';
import { fitsIn, h, icons, measureBox, setButton } from './dom.ts';
import {
  confirmScreen,
  controls,
  flowScreen,
  hint,
  sampleBox,
  tapButton,
  type FlowHost,
} from './flow.ts';
import { t } from './i18n.ts';
import { packPages } from './paginate.ts';
import { onTap } from './tap.ts';

const LINE_HEIGHTS = [1.5, 1.75, 2, 2.25, 2.5, 3];
const MAX_ITEMS_PER_PAGE = 3;

type MenuItem = { label: string; action: () => void; spark?: boolean };

export type IntroLauncher = {
  /** Beschriftung im Menü: „noch einmal“ oder „fortsetzen“. */
  menuLabel(): string;
  start(): void;
};

export class SettingsFlow {
  constructor(
    private readonly host: FlowHost,
    private readonly intro: IntroLauncher,
  ) {}

  private overviewButton(): HTMLButtonElement {
    return tapButton(t('nav.overview'), 'left', () => this.host.showOverview(), 'btn-overview');
  }

  private backToMenu(): HTMLButtonElement {
    return tapButton(t('nav.back'), 'left', () => this.showMenu(), 'btn-back');
  }

  // --- Menü ------------------------------------------------------------------

  showMenu(page = 0): void {
    const items: MenuItem[] = [
      { label: t('settings.menu.font'), action: () => this.fontScreen() },
      { label: t('settings.menu.colors'), action: () => this.colorsScreen() },
      { label: t('settings.menu.lineHeight'), action: () => this.lineHeightScreen() },
      { label: t('settings.menu.interests'), action: () => void this.interests() },
      { label: this.intro.menuLabel(), action: () => this.intro.start() },
      { label: t('settings.menu.reset'), action: () => void this.reset() },
      { label: t('settings.menu.spark'), action: () => this.sparkScreen(), spark: true },
    ];
    const list = h('div', { class: 'cards menu' });
    const back = tapButton(t('nav.back'), 'left', () => go(current - 1), 'btn-back');
    const next = tapButton(t('nav.next'), 'right', () => go(current + 1), 'btn-next');
    const info = h('p', { class: 'pageinfo', 'aria-live': 'polite' });
    const { screen } = flowScreen({
      rail: this.overviewButton(),
      title: t('settings.title'),
      content: [list],
      bar: [back, info, next],
    });
    this.host.mount(screen);

    const entry = (item: MenuItem): HTMLButtonElement => {
      const b = h(
        'button',
        { type: 'button', class: 'card menu-item' },
        h('span', { class: 'title' }, item.spark ? icons.spark() : null, item.label),
      );
      b.append(icons.right());
      return b;
    };
    const box = measureBox(list);
    const pages = packPages(items, MAX_ITEMS_PER_PAGE, (group) => {
      box.replaceChildren(...group.map(entry));
      return fitsIn(box);
    });
    box.remove();
    let current = 0;
    const go = (p: number): void => {
      current = Math.max(0, Math.min(pages.length - 1, p));
      list.replaceChildren(
        ...(pages[current] ?? []).map((item) => {
          const b = entry(item);
          onTap(b, item.action);
          return b;
        }),
      );
      info.textContent = t('pager.pageOf', { page: current + 1, total: pages.length });
      setButton(back, t('nav.back'), 'left', { inactive: current === 0 });
      setButton(next, t('nav.next'), 'right', { inactive: current >= pages.length - 1 });
    };
    go(page);
  }

  /** Bedeutung des Funkelsterns (SPEC §6). */
  private sparkScreen(): void {
    const { screen } = flowScreen({
      rail: this.overviewButton(),
      title: t('settings.menu.spark'),
      content: [
        h('p', { class: 'flowhint spark-info' }, icons.spark(), ' ', t('settings.sparkInfo')),
      ],
      bar: [this.backToMenu(), null, null],
    });
    this.host.mount(screen);
  }

  // --- Schrift (SPEC §8.4) -------------------------------------------------------

  private fontScreen(): void {
    // Wie bei der Kalibrierung: beginnt bei 18 pt und geht in Stufen von ca. +26 % [R1].
    let step = 0;
    const sizeAt = (i: number): number => CALIBRATION_SIZES_PX[i] ?? CALIBRATION_SIZES_PX[0] ?? 24;
    const last = CALIBRATION_SIZES_PX.length - 1;
    const render = (): void => {
      const draft = { ...this.host.settings, fontSizePx: sizeAt(step) };
      const sample = sampleBox(draft, this.host.sampleSentences());
      const smaller = tapButton(
        t('settings.font.smaller'),
        'minus',
        () => ((step = Math.max(0, step - 1)), render()),
      );
      const larger = tapButton(
        t('settings.font.larger'),
        'plus',
        () => ((step = Math.min(last, step + 1)), render()),
      );
      if (step === 0) setButton(smaller, t('settings.font.smaller'), 'minus', { inactive: true });
      if (step === last) setButton(larger, t('settings.font.larger'), 'plus', { inactive: true });
      const done = tapButton(t('settings.font.comfortable'), 'check', () =>
        this.confirmFont(step, false),
      );
      const { screen } = flowScreen({
        rail: this.overviewButton(),
        title: t('settings.menu.font'),
        content: [hint(t('settings.font.hint')), sample.el, controls(smaller, larger)],
        bar: [
          this.backToMenu(),
          h(
            'p',
            { class: 'pageinfo' },
            t('settings.font.step', { step: step + 1, total: CALIBRATION_SIZES_PX.length }),
          ),
          done,
        ],
      });
      this.host.mount(screen);
      sample.fit();
    };
    render();
  }

  /** Rückfrage mit dem Schalter „Eine Stufe größer“ (SPEC §8.4): die Vorschau zeigt, was gespeichert wird. */
  private confirmFont(step: number, oneUp: boolean): void {
    const last = CALIBRATION_SIZES_PX.length - 1;
    const fontSizePx = CALIBRATION_SIZES_PX[Math.min(last, step + (oneUp ? 1 : 0))] ?? 24;
    const toggle = tapButton(
      t('settings.font.oneUp'),
      'plus',
      () => this.confirmFont(step, !oneUp),
      'btn-toggle',
    );
    setButton(toggle, t('settings.font.oneUp'), 'plus', {
      selected: oneUp,
      inactive: step >= last,
    });
    confirmScreen(this.host, {
      preview: { ...this.host.settings, fontSizePx },
      extra: toggle,
      onYes: () => this.save({ fontSizePx }, 'kalibrierung'),
      onNo: () => this.showMenu(),
    });
  }

  // --- Farben --------------------------------------------------------------------

  private colorsScreen(): void {
    let theme = this.host.settings.theme;
    const render = (): void => {
      const sample = sampleBox({ ...this.host.settings, theme }, this.host.sampleSentences());
      const light = tapButton(
        t('settings.colors.light'),
        'check',
        () => ((theme = 'light'), render()),
      );
      const dark = tapButton(
        t('settings.colors.dark'),
        'check',
        () => ((theme = 'dark'), render()),
      );
      setButton(light, t('settings.colors.light'), 'check', { selected: theme === 'light' });
      setButton(dark, t('settings.colors.dark'), 'check', { selected: theme === 'dark' });
      const { screen } = flowScreen({
        rail: this.overviewButton(),
        title: t('settings.menu.colors'),
        content: [hint(t('settings.colors.hint')), sample.el, controls(light, dark)],
        bar: [
          this.backToMenu(),
          null,
          tapButton(t('nav.save'), 'right', () => this.confirm({ theme }, 'nutzerin'), 'btn-next'),
        ],
      });
      this.host.mount(screen);
      sample.fit();
    };
    render();
  }

  // --- Zeilenabstand ---------------------------------------------------------------

  private lineHeightScreen(): void {
    const start = LINE_HEIGHTS.findIndex((v) => v >= this.host.settings.lineHeight);
    let i = start === -1 ? LINE_HEIGHTS.length - 1 : start;
    const render = (): void => {
      const lineHeight = LINE_HEIGHTS[i] ?? 2;
      const sample = sampleBox({ ...this.host.settings, lineHeight }, this.host.sampleSentences());
      const less = tapButton(
        t('settings.lineHeight.less'),
        'minus',
        () => ((i = Math.max(0, i - 1)), render()),
      );
      const more = tapButton(t('settings.lineHeight.more'), 'plus', () => {
        i = Math.min(LINE_HEIGHTS.length - 1, i + 1);
        render();
      });
      if (i === 0) setButton(less, t('settings.lineHeight.less'), 'minus', { inactive: true });
      if (i === LINE_HEIGHTS.length - 1)
        setButton(more, t('settings.lineHeight.more'), 'plus', { inactive: true });
      const { screen } = flowScreen({
        rail: this.overviewButton(),
        title: t('settings.menu.lineHeight'),
        content: [hint(t('settings.lineHeight.hint')), sample.el, controls(less, more)],
        bar: [
          this.backToMenu(),
          null,
          tapButton(t('nav.save'), 'right', () => this.confirm({ lineHeight }, 'nutzerin')),
        ],
      });
      this.host.mount(screen);
      sample.fit();
    };
    render();
  }

  // --- Wie am Anfang -----------------------------------------------------------------

  private async reset(): Promise<void> {
    const base = await fetchBaseline().catch(() => null);
    if (!base) return this.showMenu();
    confirmScreen(this.host, {
      description: t('confirm.reset'),
      preview: base,
      onYes: async () => {
        await this.save(base, 'wie-am-anfang');
      },
      onNo: () => this.showMenu(),
    });
  }

  // --- Rückfrage und Speichern ----------------------------------------------------------

  private confirm(change: Partial<Settings>, source: 'nutzerin' | 'kalibrierung'): void {
    confirmScreen(this.host, {
      preview: { ...this.host.settings, ...change },
      onYes: async () => {
        await this.save(change, source);
      },
      onNo: () => this.showMenu(),
    });
  }

  private async save(
    change: Partial<Settings>,
    source: Parameters<typeof saveSettings>[1],
  ): Promise<void> {
    try {
      await this.host.applySaved(await saveSettings(change, source));
    } catch {
      // Nicht erreichbar: nichts ändert sich unbemerkt; zurück ins Menü.
    }
    this.showMenu();
  }

  // --- Was ich gern lese (SPEC §5.3) -------------------------------------------------------

  private async interests(): Promise<void> {
    if (this.host.settings.interestLearning !== true) return this.consentScreen();
    const list = await fetchInterests().catch(() => [] as Interest[]);
    if (!list.length) return this.emptyInterests();
    this.topicScreen(list, 0, {});
  }

  private consentScreen(): void {
    const yes = tapButton(t('interests.yes'), 'check', () =>
      confirmScreen(this.host, {
        description: t('confirm.start'),
        onYes: () => this.save({ interestLearning: true }, 'nutzerin'),
        onNo: () => this.showMenu(),
      }),
    );
    const no = tapButton(t('interests.no'), 'left', () => {
      // Noch nie gefragt: die Antwort merken; sonst bleibt alles, wie es ist.
      if (this.host.settings.interestLearning === null)
        void this.save({ interestLearning: false }, 'nutzerin');
      else this.showMenu();
    });
    const { screen } = flowScreen({
      rail: this.overviewButton(),
      title: t('settings.menu.interests'),
      content: [hint(t('interests.consent')), controls(yes, no)],
      bar: [this.backToMenu(), null, null],
    });
    this.host.mount(screen);
  }

  private stopButton(): HTMLButtonElement {
    return tapButton(t('interests.stop'), 'minus', () =>
      confirmScreen(this.host, {
        description: t('confirm.stop'),
        onYes: () => this.save({ interestLearning: false }, 'nutzerin'),
        onNo: () => this.showMenu(),
      }),
    );
  }

  private emptyInterests(): void {
    const { screen } = flowScreen({
      rail: this.overviewButton(),
      title: t('settings.menu.interests'),
      content: [hint(t('interests.empty')), controls(this.stopButton())],
      bar: [this.backToMenu(), null, null],
    });
    this.host.mount(screen);
  }

  private topicScreen(list: Interest[], i: number, adjust: Record<string, number>): void {
    if (i >= list.length) return this.interestsEnd(list, adjust);
    const item = list[i];
    if (!item) return;
    const shown = item.weight + (adjust[item.topic] ?? 0) * 3;
    const level = shown >= 6 ? 'often' : shown >= 1 ? 'sometimes' : 'rarely';
    const toggle = (dir: number): void => {
      adjust[item.topic] = adjust[item.topic] === dir ? 0 : dir;
      this.topicScreen(list, i, adjust);
    };
    const more = tapButton(t('interests.more'), 'plus', () => toggle(1));
    const less = tapButton(t('interests.less'), 'minus', () => toggle(-1));
    setButton(more, t('interests.more'), 'plus', { selected: adjust[item.topic] === 1 });
    setButton(less, t('interests.less'), 'minus', { selected: adjust[item.topic] === -1 });
    const { screen } = flowScreen({
      rail: this.overviewButton(),
      title: item.topic,
      content: [hint(t(`interests.${level}`)), controls(more, less)],
      bar: [
        tapButton(
          t('nav.back'),
          'left',
          () => (i === 0 ? this.showMenu() : this.topicScreen(list, i - 1, adjust)),
          'btn-back',
        ),
        h('p', { class: 'pageinfo' }, t('interests.topicOf', { n: i + 1, total: list.length })),
        tapButton(t('nav.next'), 'right', () => this.topicScreen(list, i + 1, adjust), 'btn-next'),
      ],
    });
    this.host.mount(screen);
  }

  private interestsEnd(list: Interest[], adjust: Record<string, number>): void {
    const changes = Object.fromEntries(Object.entries(adjust).filter(([, v]) => v !== 0));
    const save = Object.keys(changes).length
      ? tapButton(t('nav.save'), 'check', () =>
          confirmScreen(this.host, {
            description: t('confirm.adjust'),
            onYes: async () => {
              await saveInterests({ adjust: changes }).catch(() => undefined);
              this.showMenu();
            },
            onNo: () => this.showMenu(),
          }),
        )
      : null;
    const forget = tapButton(t('interests.forget'), 'minus', () =>
      confirmScreen(this.host, {
        description: t('confirm.forget'),
        onYes: async () => {
          await saveInterests({ forgetAll: true }).catch(() => undefined);
          this.showMenu();
        },
        onNo: () => this.showMenu(),
      }),
    );
    const { screen } = flowScreen({
      rail: this.overviewButton(),
      title: t('settings.menu.interests'),
      content: [hint(t('interests.end')), controls(save, forget, this.stopButton())],
      bar: [
        tapButton(t('nav.back'), 'left', () => this.topicScreen(list, list.length - 1, adjust)),
        null,
        null,
      ],
    });
    this.host.mount(screen);
  }
}
