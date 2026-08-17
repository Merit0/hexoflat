import { sha256Hex } from './hash/sha256';
import type { RandomNumberGenerator } from './random';

/**
 * A deterministic random source that survives a snapshot.
 *
 * `random.ts` gave the engine the *port* (`RandomNumberGenerator`) but the
 * only implementation was `Math.random`. That meant `serializeState` restored
 * where the world was, yet the very next random decision after a restore
 * diverged — so a snapshot restored the state without reproducing the game.
 * Replay and authoritative co-op validation (architecture rule #4) both need
 * the stronger property, which is what this provides: the seed *and* how far
 * the sequence has advanced are part of the state.
 *
 * The generator is SHA-256 over `seed#cursor`. Deliberately not a fast PRNG
 * (xorshift, mulberry32): the digest is already in the engine for snapshot
 * checksums, it needs no separate correctness argument, and it makes the
 * sequence a pure function of `(seed, cursor)` — so any two peers can compute
 * the same draw from the state alone, without having replayed the same calls.
 */

export interface RngState {
  /** Fixed for the lifetime of the world. */
  seed: string;
  /** How many numbers have been drawn. Advancing this is the only mutation. */
  cursor: number;
}

export function createRngState(seed: string): RngState {
  return { seed, cursor: 0 };
}

export function cloneRngState(state: RngState): RngState {
  return { seed: state.seed, cursor: state.cursor };
}

/** 13 hex digits = 52 bits — a double's full mantissa, so no value is unreachable. */
const MANTISSA_HEX_DIGITS = 13;
const MANTISSA_RANGE = 2 ** 52;

/** The draw at a given cursor position, without advancing anything. */
export function randomAt(state: RngState, cursor: number): number {
  const digest = sha256Hex(`${state.seed}#${cursor}`);

  return Number.parseInt(digest.slice(0, MANTISSA_HEX_DIGITS), 16) / MANTISSA_RANGE;
}

/**
 * A generator bound to `state`: every call advances `state.cursor` in place,
 * so the caller's state object always knows how far the sequence has run.
 *
 * Bind it once per command rather than holding one across commands — the
 * point is that the cursor lives in the state, not in a closure someone has
 * to remember to serialize.
 */
export function createSeededRandom(state: RngState): RandomNumberGenerator {
  return () => {
    const value = randomAt(state, state.cursor);
    state.cursor += 1;

    return value;
  };
}
