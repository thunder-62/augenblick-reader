/**
 * Taste „Lesen“ (SPEC §16.2): unten rechts, Ziel 20 mm, Buch-Symbol + Wort, Kontrast ≥ 7:1.
 * In einem geschlossenen Shadow DOM, damit die Seite sie weder verstellt noch verändert.
 */
import { DEFAULT_SETTINGS, EDGE_MM, mm, TAP_TARGET_MM, THEMES } from '@augenblick/shared';
import { onTap, t } from '@augenblick/web/reader';

/** Höchster z-index: über Cookie-Bannern und Leisten der Seite. */
export const TOP_Z = '2147483647';

const BOOK =
  'M3 4.5C5.8 4 8.6 4.4 11 6v14c-2.4-1.6-5.2-2-8-1.5zM21 4.5C18.2 4 15.4 4.4 13 6v14c2.4-1.6 5.2-2 8-1.5z';

const colors = THEMES[DEFAULT_SETTINGS.theme];

/**
 * Viele Seiten sind am Handy herausgezoomt (ohne viewport-Angabe). Damit die Taste trotzdem
 * 20 mm groß ist, werden ihre Maße durch den Zoom geteilt.
 */
const zoom = (): number => window.visualViewport?.scale || 1;

function css(): string {
  return `
  :host { all: initial; }
  button {
    all: initial;
    box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    gap: calc(var(--u) * 10px);
    min-height: calc(var(--u) * ${mm(TAP_TARGET_MM)}px);
    min-width: calc(var(--u) * ${mm(TAP_TARGET_MM) * 1.6}px);
    padding: 0 calc(var(--u) * 24px);
    border: calc(var(--u) * 3px) solid ${colors.border};
    border-radius: calc(var(--u) * 14px);
    background: ${colors.bg};
    color: ${colors.text};
    font: 700 calc(var(--u) * 30px) / 1.2 'Atkinson Hyperlegible', Verdana, sans-serif;
    cursor: pointer;
    touch-action: none;
    user-select: none; -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    box-shadow: 0 0 0 calc(var(--u) * 2px) ${colors.bg};
  }
  button.pressed, button.tapped { background: ${colors.text}; color: ${colors.bg}; border-color: ${colors.text}; }
  button:focus-visible { outline: calc(var(--u) * 3px) solid ${colors.text}; outline-offset: calc(var(--u) * 4px); }
  svg { width: 1.1em; height: 1.1em; fill: currentColor; flex: none; }
  `;
}

export type ReadButton = { host: HTMLElement; show: (visible: boolean) => void };

export function createReadButton(onOpen: () => void): ReadButton {
  const host = document.createElement('augenblick-lesen');
  const place = (): void => {
    const u = 1 / zoom();
    host.style.cssText = [
      'position:fixed',
      `right:${mm(EDGE_MM) * u}px`,
      `bottom:${mm(EDGE_MM) * u}px`,
      `z-index:${TOP_Z}`,
      'display:block',
      'margin:0',
      'padding:0',
      `--u:${u}`,
    ].join(';');
  };
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = css();
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', t('extension.read'));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', BOOK);
  svg.append(path);
  const label = document.createElement('span');
  label.textContent = t('extension.read');
  button.append(svg, label);
  shadow.append(style, button);
  onTap(button, onOpen);
  place();
  window.visualViewport?.addEventListener('resize', place);

  const show = (visible: boolean): void => {
    if (visible && !host.isConnected) document.documentElement.append(host);
    if (!visible) host.remove();
  };
  return { host, show };
}
