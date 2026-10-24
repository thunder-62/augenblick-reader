/** Bildschirm bleibt im Artikel an, in der Übersicht nicht (SPEC §8.1). */
let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function acquire(): Promise<void> {
  if (!wanted || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible')
    return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    // Ohne HTTPS (bis M4) oder bei Energiesparmodus nicht verfügbar – kein Fehler für die Nutzerin.
  }
}

export function keepAwake(on: boolean): void {
  wanted = on;
  if (on) void acquire();
  else if (sentinel) {
    void sentinel.release();
    sentinel = null;
  }
}

document.addEventListener('visibilitychange', () => void acquire());
