import type { Theme } from './types.ts';

export type ThemeColors = {
  /** Hintergrund */
  bg: string;
  /** Fließtext */
  text: string;
  /** Gedämpfter Text (Kopf, Fußleiste, Rubrik) – trotzdem ≥ 7:1. */
  muted: string;
  /** Rahmen von Tasten und Karten (Nicht-Text, ≥ 3:1). */
  border: string;
  /** Rahmen inaktiver Tasten. */
  borderInactive: string;
  /** Text inaktiver Tasten – bleibt lesbar (≥ 7:1). */
  inactive: string;
};

/** Farbschemata nach SPEC §8.4 und [R7]. */
export const THEMES: Record<Theme, ThemeColors> = {
  light: {
    bg: '#FAF7F0',
    text: '#111111',
    muted: '#3D3A35',
    border: '#3D3A35',
    borderInactive: '#8A8478',
    inactive: '#4A463F',
  },
  dark: {
    bg: '#000000',
    text: '#F2EAD3',
    muted: '#C9C1AC',
    border: '#9C9585',
    borderInactive: '#5E5A50',
    inactive: '#ABA492',
  },
};

/** Textfarben, die auf dem Hintergrund liegen und ≥ 7:1 erreichen müssen. */
export const TEXT_TOKENS = ['text', 'muted', 'inactive'] as const;
