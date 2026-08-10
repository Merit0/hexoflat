const WORLD_TICK_INTERVAL_MS = 250;

/**
 * The world's heartbeat: a plain interval that asks the caller to run one
 * tick, nothing more.
 *
 * The timer is the only thing that lives here — what a tick *does* (running
 * WORLD_TICK through the engine, marking tiles dirty, saving) stays with the
 * store that owns that state. Splitting it this way means the schedule can
 * be started, stopped and reasoned about without a running game, and the
 * store no longer holds a browser timer handle.
 */
export class WorldLoop {
  private timer: number | null = null;

  get isRunning(): boolean {
    return this.timer !== null;
  }

  /** Starting an already-running loop is a no-op, not a second timer. */
  start(onTick: () => void): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(onTick, WORLD_TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }
}

/**
 * Module-level singleton, matching the previous `let worldTimer` — the loop
 * deliberately outlives Pinia store resets so a re-created store cannot
 * silently leak a second heartbeat.
 */
export const worldLoop = new WorldLoop();
