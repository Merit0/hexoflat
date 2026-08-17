import { describe, expect, it } from 'vitest';
import { applyCommand } from './apply-command';
import { createEngineState } from './engine-state';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { getOddQNeighbors, coordinateKey } from '../utils/hex-utils';
import type HexMapModel from '../map/models/hex-map-model';
import type { HexEngineState } from './engine-state';
import { buildHero, createContext, nextCommandId, TEST_ACTOR_ID } from './command-test-fixtures';

/**
 * The step-based reveal rule as it actually reaches the game: through
 * `MOVE_HERO`, behind `FEATURE_EXPLORATION_SLICE`.
 *
 * The gate is the load-bearing part. Every world map that exists today runs
 * with the flag off, and E1's contract is that they behave exactly as they
 * did before — so "flag off changes nothing" is tested first and hardest.
 */

const START = { columnIndex: 0, rowIndex: 0 };
const TARGET = { columnIndex: 1, rowIndex: 0 };

function buildWalkableMap(): HexMapModel {
  const map = new HexMapBuilder().name('move-discovery').width(4).height(4).build();
  // Movement needs revealed tiles to plan through; this is the pre-slice
  // world's own starting condition, so the test exercises the same ground the
  // existing game stands on.
  for (const tile of map.tiles) tile.isRevealed = true;

  return map;
}

function stateWith(map: HexMapModel, explorationSlice: boolean): HexEngineState {
  const hero = buildHero({ coordinates: { ...START } });

  return createEngineState({
    map,
    heroes: { [hero.id]: hero },
    seed: 'move-hero-discovery',
    features: { explorationSlice },
  });
}

function move(state: HexEngineState, commandId = nextCommandId()) {
  return applyCommand(
    state,
    {
      commandId,
      actorId: TEST_ACTOR_ID,
      type: 'MOVE_HERO',
      payload: { heroId: 'hero-1', target: TARGET },
    },
    createContext(),
  );
}

describe('MOVE_HERO with the exploration slice off', () => {
  it('emits no discovery events at all', () => {
    const { events } = move(stateWith(buildWalkableMap(), false));

    expect(events.map((event) => event.type)).toEqual(['HERO_MOVED']);
  });

  it('leaves discovery state exactly as the pre-slice game left it', () => {
    const map = buildWalkableMap();
    const before = map.tiles.map((tile) => tile.discovery);

    move(stateWith(map, false));

    expect(map.tiles.map((tile) => tile.discovery)).toEqual(before);
  });

  it('defaults to off when the caller says nothing about features', () => {
    const map = buildWalkableMap();
    const hero = buildHero({ coordinates: { ...START } });
    const state = createEngineState({
      map,
      heroes: { [hero.id]: hero },
      seed: 'defaults-off',
    });

    const { events } = move(state);

    expect(events.map((event) => event.type)).toEqual(['HERO_MOVED']);
  });
});

describe('MOVE_HERO with the exploration slice on', () => {
  it('discovers the hexes walked and observes the ring around them', () => {
    const map = new HexMapBuilder().name('slice-move').width(4).height(4).build();
    for (const tile of map.tiles) tile.isRevealed = true;
    // Start from a blank slate so the events describe real transitions rather
    // than re-stating what the map was already set to.
    for (const tile of map.tiles) tile.discovery = 'UNKNOWN';
    // The planner needs a legal route, which needs revealed tiles; give it the
    // two hexes the hero walks and nothing else.
    map.getTileAt(START)!.discovery = 'DISCOVERED';
    map.getTileAt(TARGET)!.discovery = 'DISCOVERED';

    const { events } = move(stateWith(map, true));

    expect(events[0].type).toBe('HERO_MOVED');
    expect(events.some((event) => event.type === 'HEX_OBSERVED')).toBe(true);

    for (const neighbor of getOddQNeighbors(TARGET)) {
      const tile = map.getTileAt(neighbor);
      if (!tile) continue;
      expect(['OBSERVED', 'DISCOVERED'], coordinateKey(neighbor)).toContain(tile.discovery);
    }
  });

  it('does not discover twice when the same commandId is replayed', () => {
    // E0's idempotency guarantee has to hold for the new rule too: a retry
    // after a dropped socket must not widen the frontier a second time.
    const map = buildWalkableMap();
    for (const tile of map.tiles) tile.discovery = 'UNKNOWN';
    map.getTileAt(START)!.discovery = 'DISCOVERED';
    map.getTileAt(TARGET)!.discovery = 'DISCOVERED';

    const state = stateWith(map, true);
    const commandId = nextCommandId();

    const first = move(state, commandId);
    const snapshot = map.tiles.map((tile) => tile.discovery);
    const second = move(state, commandId);

    expect(second.replayed).toBe(true);
    expect(second.events).toEqual(first.events);
    expect(map.tiles.map((tile) => tile.discovery)).toEqual(snapshot);
  });

  it('is not enabled in a multiplayer session — the engine decides, not the caller', async () => {
    const { isExplorationSliceEnabled } = await import('../features/feature-flags');

    expect(
      isExplorationSliceEnabled({
        explorationSliceRequested: true,
        isMultiplayerSession: true,
      }),
    ).toBe(false);
  });
});
