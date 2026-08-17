import type HexMapModel from '../map/models/hex-map-model';
import type { IActionContext } from '../abstraction/abstract-action';
import type { HeroState } from '../hero-movement/hero-state';
import { createRngState, type RngState } from '../utils/seeded-random';
import type { AppliedCommandLog } from './applied-command-log';

/**
 * Which slice rules are live for this session.
 *
 * Session config, not game state: it is resolved from the build/room by
 * `features/feature-flags.ts` and deliberately **not** part of the snapshot,
 * so a save file cannot turn a rule on. `deserializeState` therefore takes it
 * as an argument rather than reading it back.
 */
export interface EngineFeatureSet {
  explorationSlice: boolean;
}

export const NO_ENGINE_FEATURES: EngineFeatureSet = { explorationSlice: false };

/**
 * The whole of a scenario's authoritative game state.
 *
 * Lives in its own module rather than next to `applyCommand` so that command
 * handlers can depend on the shape without importing the dispatcher that
 * calls them — otherwise the handler registry and `apply-command.ts` would
 * form an import cycle.
 */
export interface HexEngineState {
  map: HexMapModel;
  heroes: Record<string, HeroState>;
  /**
   * Seed plus how far the sequence has advanced. Part of the state, not a
   * caller-side detail, so that a restored snapshot keeps rolling the same
   * numbers the original run would have rolled next.
   */
  rngState: RngState;
  /**
   * Bumped once per command that actually ran (a replayed duplicate does not
   * bump it). Callers pass `expectedStateVersion` to say which world they
   * were looking at when they decided.
   */
  stateVersion: number;
  /** Recent `commandId`s and what they produced — see `applied-command-log.ts`. */
  appliedCommands: AppliedCommandLog;
  /** Slice rules that are live. Never serialized — see `EngineFeatureSet`. */
  features: EngineFeatureSet;
}

/** Everything applyCommand needs beyond map/now — built by the caller from its own stores/ports. */
export type HexEngineActionContext = Omit<IActionContext, 'map' | 'now'>;

export interface CreateEngineStateInit {
  map: HexMapModel;
  heroes?: Record<string, HeroState>;
  /**
   * Required, and deliberately not defaulted: a shared default seed would make
   * every fresh world in the game roll identically. Pass something already
   * unique to this world — a map id, a scenario id, a snapshot checksum.
   */
  seed: string;
  /** Resume an in-flight sequence instead of starting one (snapshot restore). */
  rngState?: RngState;
  stateVersion?: number;
  appliedCommands?: AppliedCommandLog;
  /**
   * Defaults to everything off. Callers that want a slice rule live must ask
   * for it explicitly — an omission can only ever make the engine behave the
   * way it did before the slice existed.
   */
  features?: EngineFeatureSet;
}

export function createEngineState(init: CreateEngineStateInit): HexEngineState {
  return {
    map: init.map,
    heroes: init.heroes ?? {},
    rngState: init.rngState ?? createRngState(init.seed),
    stateVersion: init.stateVersion ?? 0,
    appliedCommands: init.appliedCommands ?? [],
    features: init.features ?? { ...NO_ENGINE_FEATURES },
  };
}
