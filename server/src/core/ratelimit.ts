/** Einfaches gleitendes Fenster, z. B. „höchstens 50 Abrufe pro Stunde“. */
export class RateLimiter {
  private readonly stamps: number[] = [];

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  private prune(): void {
    const cutoff = this.now() - this.windowMs;
    while (this.stamps.length && (this.stamps[0] ?? 0) <= cutoff) this.stamps.shift();
  }

  remaining(): number {
    this.prune();
    return Math.max(0, this.limit - this.stamps.length);
  }

  /** Verbraucht einen Abruf; false, wenn das Kontingent erschöpft ist. */
  take(): boolean {
    if (this.remaining() === 0) return false;
    this.stamps.push(this.now());
    return true;
  }
}
