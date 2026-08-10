import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';

/**
 * Which tiles the renderer still has to redraw.
 *
 * This is a pure render-side optimisation with no domain meaning — it exists
 * so use-hex-board.ts's tiles layer can recompute only the tiles that
 * actually changed instead of deep-walking the whole tiles array on every
 * mutation. It lived in world-map-store.ts purely because that is where the
 * mutations happen, which is exactly the "gravity of state" pull described in
 * section 1.3 of docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md.
 *
 * The id set is deliberately plain (not reactive): only the `tick` counter
 * needs to be a Vue-tracked signal, and the store owns that. The ids
 * themselves are read exactly once per flush.
 */
export class TileDirtyTracker {
  private readonly ids = new Set<string>();

  add(coordinates: IHexCoordinates): void {
    this.ids.add(coordinateKey(coordinates));
  }

  addMany(coordinatesList: IHexCoordinates[]): void {
    for (const coordinates of coordinatesList) this.add(coordinates);
  }

  /**
   * Hands over the accumulated ids and clears them, so the next mutation
   * starts from empty. Returns a copy — callers iterate it after the
   * tracker has already moved on.
   */
  consume(): Set<string> {
    const ids = new Set(this.ids);
    this.ids.clear();
    return ids;
  }

  get size(): number {
    return this.ids.size;
  }
}

/**
 * Module-level singleton, matching the previous behaviour: dirty tracking
 * deliberately outlives Pinia store resets, because the renderer's pending
 * work is not part of game state.
 */
export const tileDirtyTracker = new TileDirtyTracker();
