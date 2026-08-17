import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import type HexMapModel from '../map/models/hex-map-model';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import {
  findAttackOptions,
  findAutoDefendCoords,
  findRetreatOptions,
} from '../combat/ai-controller';
import { pickRandom } from '../utils/random';
import { createSeededRandom } from '../utils/seeded-random';
import { createEngineState, type HexEngineState } from './engine-state';
import { deserializeState, serializeState } from './snapshot';

/**
 * The E0 acceptance criterion: two runs from the same seed make the same
 * sequence of AI decisions, and a snapshot restore *continues* that sequence
 * rather than restarting it.
 *
 * The second half is the part that was actually broken. Before E0 the engine
 * had the RNG port but no seeded implementation, so `serializeState` restored
 * where the world was while the very next random decision diverged — a
 * snapshot that restored the state without reproducing the game.
 *
 * Combat's own state still lives in `apps/web` by design (CLAUDE.md), so this
 * drives the pure decision functions in `combat/ai-controller.ts` the same way
 * `combat-store` composes them — reading combat, changing nothing about it.
 */

const HERO_AT = { columnIndex: 2, rowIndex: 2 };
const ENEMY_AT = { columnIndex: 0, rowIndex: 0 };
const STEP_BUDGET = 4;

function buildMap(): HexMapModel {
  const map = new HexMapBuilder().name('determinism').width(5).height(5).build();
  for (const tile of map.tiles) tile.isRevealed = true;

  const enemyTile = map.getTileAt(ENEMY_AT)!;
  enemyTile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETOR, enemyTile.coordinates);

  return map;
}

function buildState(seed: string): HexEngineState {
  return createEngineState({ map: buildMap(), seed });
}

/** One enemy turn's worth of choices, in the order `combat-store` makes them. */
function decideEnemyTurn(state: HexEngineState): string {
  const random = createSeededRandom(state.rngState);
  const { map } = state;

  const attack = pickRandom(findAttackOptions(map, ENEMY_AT, HERO_AT, STEP_BUDGET), random);
  const defend = pickRandom(findAutoDefendCoords(map, ENEMY_AT), random);
  const retreat = pickRandom(findRetreatOptions(map, ENEMY_AT, HERO_AT, STEP_BUDGET), random);

  return JSON.stringify({ attack: attack?.coord, defend, retreat: retreat?.coord });
}

function decideTurns(state: HexEngineState, count: number): string[] {
  return Array.from({ length: count }, () => decideEnemyTurn(state));
}

describe('engine determinism', () => {
  it('makes the same AI decisions twice when the seed is the same', () => {
    expect(decideTurns(buildState('run-1'), 8)).toEqual(decideTurns(buildState('run-1'), 8));
  });

  it('makes different AI decisions under a different seed', () => {
    expect(decideTurns(buildState('run-1'), 8)).not.toEqual(decideTurns(buildState('run-2'), 8));
  });

  it('has decisions that actually vary turn to turn', () => {
    // Guards against the failure mode where "deterministic" is achieved by the
    // sequence never advancing at all.
    const turns = decideTurns(buildState('varies'), 8);

    expect(new Set(turns).size).toBeGreaterThan(1);
  });

  it('continues the sequence across a snapshot round trip instead of replaying it', () => {
    const uninterrupted = decideTurns(buildState('resume'), 6);

    const state = buildState('resume');
    const before = decideTurns(state, 3);
    const restored = deserializeState(serializeState(state), 0);
    const after = decideTurns(restored, 3);

    expect([...before, ...after]).toEqual(uninterrupted);
  });

  it('carries the exact cursor through serialize/deserialize', () => {
    const state = buildState('cursor');
    decideTurns(state, 4);

    const restored = deserializeState(serializeState(state), 0);

    expect(restored.rngState).toEqual(state.rngState);
    expect(restored.rngState.cursor).toBeGreaterThan(0);
  });
});
