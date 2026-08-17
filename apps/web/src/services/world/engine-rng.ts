import type { RandomNumberGenerator } from '@hexoflat/engine/utils/random';
import {
  createRngState,
  createSeededRandom,
  type RngState,
} from '@hexoflat/engine/utils/seeded-random';

/**
 * The single owner of the loaded world's random sequence in `apps/web`.
 *
 * The engine keeps `rngState` inside `HexEngineState`, but the web app never
 * holds a long-lived `HexEngineState` — every `applyCommand` call builds a
 * throwaway `{ map, heroes, rngState }`. Something has to outlive those
 * objects or the cursor resets on every command and the sequence stops being
 * a sequence. That is this module.
 *
 * It is also why this is a service and not store state: both `world-map-store`
 * (spawn placement, engine dispatch) and `hero-inventory-store` (free slot
 * pick) draw from it, and making one store import the other would close an
 * import cycle. A module singleton is the same shape `world-loop.ts`,
 * `tile-dirty-tracker.ts` and `respawn-schedule.ts` already use here.
 *
 * One world is loaded at a time, so one sequence is all there is to own.
 */

let current: RngState | null = null;

/**
 * Starts (or resumes) the sequence for a world.
 *
 * `restored` is the `rngState` read back from the save; passing it is what
 * makes a reload continue the run instead of replaying it. Without it the
 * sequence is seeded from `seed` — pass the map id, which is already a UUID
 * unique to that world. Copied rather than aliased so the caller's saved
 * payload cannot be advanced behind its back.
 */
export function initEngineRng(seed: string, restored?: RngState | null): RngState {
  current = restored ? { seed: restored.seed, cursor: restored.cursor } : createRngState(seed);

  return current;
}

/**
 * The live state object — the same reference every caller gets, so a draw
 * made through `applyCommand` and a draw made directly both advance the one
 * cursor that gets saved.
 *
 * Falls back to a fresh per-session seed when nothing has been loaded yet
 * (inventory exists before any map does). That sequence is never persisted,
 * which is correct: there is no world for it to belong to.
 */
export function getEngineRngState(): RngState {
  return (current ??= createRngState(crypto.randomUUID()));
}

/** A generator bound to the live state. Advancing it advances what gets saved. */
export function engineRandom(): RandomNumberGenerator {
  return createSeededRandom(getEngineRngState());
}

/** Drops the sequence — used when a world is unloaded or all worlds are cleared. */
export function resetEngineRng(): void {
  current = null;
}
