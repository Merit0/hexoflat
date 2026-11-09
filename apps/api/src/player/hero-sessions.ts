/** One active session per hero: a new connection takes the hero over from the old one. */
export class HeroSessions {
  private readonly bySocket = new Map<string, string>();
  private readonly byHero = new Map<string, string>();

  /** Returns the socket that was just replaced, if any. */
  claim(heroId: string, socketId: string): string | null {
    this.release(socketId);
    const previous = this.byHero.get(heroId) ?? null;
    if (previous) this.bySocket.delete(previous);
    this.byHero.set(heroId, socketId);
    this.bySocket.set(socketId, heroId);
    return previous && previous !== socketId ? previous : null;
  }

  isActive(heroId: string, socketId: string): boolean {
    return this.byHero.get(heroId) === socketId;
  }

  heroOf(socketId: string): string | null {
    return this.bySocket.get(socketId) ?? null;
  }

  release(socketId: string): void {
    const heroId = this.bySocket.get(socketId);
    this.bySocket.delete(socketId);
    if (heroId && this.byHero.get(heroId) === socketId) this.byHero.delete(heroId);
  }
}

export class HeroRateLimiter {
  private readonly windows = new Map<string, { count: number; startedAt: number }>();

  constructor(
    private readonly limit = 20,
    private readonly windowMs = 1000,
    private readonly now: () => number = Date.now,
  ) {}

  allow(heroId: string): boolean {
    const now = this.now();
    const entry = this.windows.get(heroId);
    if (!entry || now - entry.startedAt >= this.windowMs) {
      this.windows.set(heroId, { count: 1, startedAt: now });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  forget(heroId: string): void {
    this.windows.delete(heroId);
  }
}
