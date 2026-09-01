import { describe, expect, it, vi } from 'vitest';
import { HexMapBuilder } from './builders/hex-map-builder';
import type HexMapModel from './models/hex-map-model';
import { coordinateKey } from '../utils/hex-utils';
import { findFreeHexNear } from './free-hex-finder';
import { getReachableTileDistances } from '../hero-movement/reachable-range-service';
import { findShortestPath } from '../hero-movement/pathfinding-service';
import { applyCommand, type HexEngineActionContext } from '../commands/apply-command';
import { EHexActionType } from '../enums/hex-action-type';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { HexEngineCommand } from '../commands/hex-engine-commands';

const HOLE = { columnIndex: 2, rowIndex: 2 };

function buildMapWithHole(): HexMapModel {
  const map = new HexMapBuilder().name('sparse-hole').width(5).height(5).build();
  for (const tile of map.tiles) tile.isRevealed = true;

  const holeIndex = map.tiles.findIndex(
    (tile) => coordinateKey(tile.coordinates) === coordinateKey(HOLE),
  );
  map.tiles.splice(holeIndex, 1);

  return map;
}

function createContext(): HexEngineActionContext {
  return {
    heroToolStore: {
      isLocked: false,
      isDragging: false,
      activeTool: null,
      hover: null,
      consumeDurability: vi.fn(() => true),
      lockTool: vi.fn(),
      unlockTool: vi.fn(),
      clearResolvedActions: vi.fn(),
      stopTool: vi.fn(),
    },
    hero: {
      hero: { name: 'Hero', maxHealth: 100, currentHealth: 100 },
      healHero: vi.fn(),
    },
    gathering: { add: vi.fn() },
    inventory: { putToInventory: vi.fn(() => ({ ok: true })) },
    events: { push: vi.fn() },
    worldMap: {
      combatActive: false,
      performHeroCombatAttack: vi.fn(() => ({ ok: true, message: '' })),
      placeCombatDefendMarker: vi.fn(() => true),
      isLocationRespawning: vi.fn(() => false),
      getLocationRespawnRemainingMs: vi.fn(() => 0),
      goToLocation: vi.fn(),
    },
  };
}

describe('sparse map: a hole in the middle of map.tiles', () => {
  it('findFreeHexNear skips a hole neighbour without throwing', () => {
    const map = buildMapWithHole();

    expect(() => findFreeHexNear(map, { columnIndex: 1, rowIndex: 2 })).not.toThrow();
    const found = findFreeHexNear(map, { columnIndex: 1, rowIndex: 2 });
    expect(coordinateKey(found ?? { columnIndex: -1, rowIndex: -1 })).not.toBe(coordinateKey(HOLE));
  });

  it('getReachableTileDistances excludes the hole and does not throw', () => {
    const map = buildMapWithHole();

    const distances = getReachableTileDistances(map, { columnIndex: 0, rowIndex: 2 }, 10);

    expect(() => getReachableTileDistances(map, { columnIndex: 0, rowIndex: 2 }, 10)).not.toThrow();
    expect(distances.has(coordinateKey(HOLE))).toBe(false);
  });

  it('findShortestPath routes around the hole instead of through it', () => {
    const map = buildMapWithHole();
    const from = { columnIndex: 0, rowIndex: 2 };
    const to = { columnIndex: 4, rowIndex: 2 };

    const path = findShortestPath(map, from, to, 20);

    expect(path).not.toBeNull();
    expect(path!.some((coord) => coordinateKey(coord) === coordinateKey(HOLE))).toBe(false);
  });

  it('findShortestPath returns null rather than throwing when the target is the hole itself', () => {
    const map = buildMapWithHole();

    expect(() => findShortestPath(map, { columnIndex: 0, rowIndex: 2 }, HOLE, 20)).not.toThrow();
    expect(findShortestPath(map, { columnIndex: 0, rowIndex: 2 }, HOLE, 20)).toBeNull();
  });

  it('applyCommand rejects START_HEX_ACTION on the hole instead of throwing', () => {
    const map = buildMapWithHole();
    const ctx = createContext();

    const command: HexEngineCommand = {
      type: 'START_HEX_ACTION',
      payload: {
        heroId: 'hero-1',
        coordinates: HOLE,
        actionType: EHexActionType.CUT,
        toolKey: HEXOBJECT_KEYS.AXE,
        now: 0,
      },
    };

    expect(() => applyCommand({ map, heroes: {} }, command, ctx)).not.toThrow();
    const result = applyCommand({ map, heroes: {} }, command, ctx);

    expect(result.events).toEqual([
      {
        type: 'HEX_ACTION_START_REJECTED',
        payload: {
          coordinates: HOLE,
          actionType: EHexActionType.CUT,
          message: 'No tile at coordinates.',
        },
      },
    ]);
  });
});
