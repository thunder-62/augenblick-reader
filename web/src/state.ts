/** Lesezustand und gelesene Artikel liegen auf dem Tablet (ADR 004). */
import type { ReadingState } from '@augenblick/shared';

const STATE_KEY = 'augenblick.v1.state';
const READ_KEY = 'augenblick.v1.read';
const MAX_READ = 300;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher voll oder gesperrt: der Zustand ist Komfort, kein Muss.
  }
}

export const loadState = (): ReadingState => read<ReadingState>(STATE_KEY, { view: 'overview' });
export const saveState = (s: ReadingState): void => write(STATE_KEY, s);

export function readIds(): Set<string> {
  return new Set(read<string[]>(READ_KEY, []));
}

export function markRead(id: string): void {
  const ids = read<string[]>(READ_KEY, []).filter((x) => x !== id);
  ids.push(id);
  write(READ_KEY, ids.slice(-MAX_READ));
}
