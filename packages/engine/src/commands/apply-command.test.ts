import { describe, expect, it, vi } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import type HexMapModel from '../map/models/hex-map-model';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import { applyCommand, type HexEngineActionContext, type HexEngineState } from './apply-command';
import type { HexEngineCommand } from './hex-engine-commands';

function buildMap(): HexMapModel {
  return new HexMapBuilder().name('test').width(2).height(1).build();
}

function toState(map: HexMapModel): HexEngineState {
  return { map };
}

function createContext(overrides: Partial<HexEngineActionContext> = {}): HexEngineActionContext {
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
    ...overrides,
  };
}

describe('applyCommand: START_HEX_ACTION', () => {
  it('starts a valid action and emits HEX_ACTION_STARTED', () => {
    const map = buildMap();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, tile.coordinates);
    const ctx = createContext();

    const command: HexEngineCommand = {
      type: 'START_HEX_ACTION',
      payload: {
        coordinates: tile.coordinates,
        actionType: EHexActionType.CUT,
        toolKey: HEXOBJECT_KEYS.AXE,
        now: 0,
      },
    };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([
      {
        type: 'HEX_ACTION_STARTED',
        payload: { coordinates: tile.coordinates, actionType: EHexActionType.CUT, endsAt: 5000 },
      },
    ]);
    expect(tile.pendingAction).toMatchObject({ type: EHexActionType.CUT, endsAt: 5000 });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() reference, not `this`-bound
    expect(ctx.heroToolStore.lockTool).toHaveBeenCalledWith(tile, 5000);
  });

  it('rejects when there is no tile at the given coordinates', () => {
    const map = buildMap();
    const ctx = createContext();
    const coordinates = { columnIndex: 99, rowIndex: 99 };

    const command: HexEngineCommand = {
      type: 'START_HEX_ACTION',
      payload: { coordinates, actionType: EHexActionType.CUT, toolKey: HEXOBJECT_KEYS.AXE, now: 0 },
    };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([
      {
        type: 'HEX_ACTION_START_REJECTED',
        payload: {
          coordinates,
          actionType: EHexActionType.CUT,
          message: 'No tile at coordinates.',
        },
      },
    ]);
  });

  it('rejects when the wrong tool is used', () => {
    const map = buildMap();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, tile.coordinates);
    const ctx = createContext();

    const command: HexEngineCommand = {
      type: 'START_HEX_ACTION',
      payload: {
        coordinates: tile.coordinates,
        actionType: EHexActionType.CUT,
        toolKey: HEXOBJECT_KEYS.HAND,
        now: 0,
      },
    };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([
      {
        type: 'HEX_ACTION_START_REJECTED',
        payload: {
          coordinates: tile.coordinates,
          actionType: EHexActionType.CUT,
          message: `Need a tool: ${HEXOBJECT_KEYS.AXE}`,
        },
      },
    ]);
    expect(tile.pendingAction).toBeNull();
  });

  it('throws on an invalid command payload', () => {
    const map = buildMap();
    const ctx = createContext();
    const command = {
      type: 'START_HEX_ACTION',
      payload: {
        coordinates: { columnIndex: 0, rowIndex: 0 },
        actionType: 'NOT_A_REAL_ACTION',
        toolKey: HEXOBJECT_KEYS.AXE,
      },
    } as unknown as HexEngineCommand;

    expect(() => applyCommand(toState(map), command, ctx)).toThrow();
  });
});

describe('applyCommand: FINISH_PENDING_ACTIONS', () => {
  it('finishes a due action and emits changed:true', () => {
    const map = buildMap();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, tile.coordinates);
    tile.pendingAction = {
      type: EHexActionType.CUT,
      startedAt: 0,
      endsAt: 5000,
      hexobjectKey: HEXOBJECT_KEYS.TREE,
      cancelled: false,
    };
    const ctx = createContext({
      heroToolStore: { ...createContext().heroToolStore, isLocked: true },
    });

    const command: HexEngineCommand = { type: 'FINISH_PENDING_ACTIONS', payload: { now: 5000 } };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([{ type: 'HEX_ACTIONS_FINISHED', payload: { changed: true } }]);
    expect(tile.pendingAction).toBeNull();
    expect(tile.hexobject).toBeNull();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() reference, not `this`-bound
    expect(ctx.gathering.add).toHaveBeenCalledWith(HEXOBJECT_KEYS.TREE, 1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() reference, not `this`-bound
    expect(ctx.heroToolStore.unlockTool).toHaveBeenCalled();
  });

  it('is a no-op when nothing is pending', () => {
    const map = buildMap();
    const ctx = createContext();

    const command: HexEngineCommand = { type: 'FINISH_PENDING_ACTIONS', payload: { now: 0 } };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([{ type: 'HEX_ACTIONS_FINISHED', payload: { changed: false } }]);
  });

  it('throws on an invalid command payload', () => {
    const map = buildMap();
    const ctx = createContext();
    const command = {
      type: 'FINISH_PENDING_ACTIONS',
      payload: { now: 'not-a-number' },
    } as unknown as HexEngineCommand;

    expect(() => applyCommand(toState(map), command, ctx)).toThrow();
  });
});

describe('applyCommand: WORLD_TICK', () => {
  it('finishes due actions and spawns resources, emits changed:true', () => {
    const map = buildMap();
    const [tileA, tileB] = map.tiles;

    tileA.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, tileA.coordinates);
    tileA.pendingAction = {
      type: EHexActionType.CUT,
      startedAt: 0,
      endsAt: 1000,
      hexobjectKey: HEXOBJECT_KEYS.TREE,
      cancelled: false,
    };

    tileB.resourceSpawner = {
      proto: { hexobjectKey: HEXOBJECT_KEYS.ROCK },
      regrowMs: 60_000,
      nextSpawnAt: 1000,
      enabled: true,
    };

    const ctx = createContext();
    const command: HexEngineCommand = { type: 'WORLD_TICK', payload: { now: 1000 } };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([{ type: 'WORLD_TICKED', payload: { changed: true } }]);
    expect(tileA.pendingAction).toBeNull();
    expect(tileB.hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.ROCK);
    expect(tileB.resourceSpawner?.nextSpawnAt).toBeNull();
  });

  it('is a no-op when nothing is due', () => {
    const map = buildMap();
    const ctx = createContext();

    const command: HexEngineCommand = { type: 'WORLD_TICK', payload: { now: 0 } };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([{ type: 'WORLD_TICKED', payload: { changed: false } }]);
  });

  it('throws on an invalid command payload', () => {
    const map = buildMap();
    const ctx = createContext();
    const command = {
      type: 'WORLD_TICK',
      payload: { now: 'not-a-number' },
    } as unknown as HexEngineCommand;

    expect(() => applyCommand(toState(map), command, ctx)).toThrow();
  });
});

describe('applyCommand: ADD_RESOURCE_SPAWNER', () => {
  it('adds a spawner to the tile and emits RESOURCE_SPAWNER_ADDED', () => {
    const map = buildMap();
    const tile = map.tiles[0];
    const ctx = createContext();

    const command: HexEngineCommand = {
      type: 'ADD_RESOURCE_SPAWNER',
      payload: {
        coordinates: tile.coordinates,
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.TREE, overrides: { regrowMs: 30_000 } },
      },
    };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([
      { type: 'RESOURCE_SPAWNER_ADDED', payload: { coordinates: tile.coordinates } },
    ]);
    expect(tile.resourceSpawner).toMatchObject({
      proto: { hexobjectKey: HEXOBJECT_KEYS.TREE, overrides: { regrowMs: 30_000 } },
      regrowMs: 30_000,
      nextSpawnAt: null,
      enabled: true,
    });
  });

  it('rejects when there is no tile at the given coordinates', () => {
    const map = buildMap();
    const ctx = createContext();
    const coordinates = { columnIndex: 99, rowIndex: 99 };

    const command: HexEngineCommand = {
      type: 'ADD_RESOURCE_SPAWNER',
      payload: { coordinates, hexobject: { hexobjectKey: HEXOBJECT_KEYS.TREE } },
    };

    const result = applyCommand(toState(map), command, ctx);

    expect(result.events).toEqual([
      {
        type: 'RESOURCE_SPAWNER_REJECTED',
        payload: { coordinates, message: 'No tile at coordinates.' },
      },
    ]);
  });

  it('throws on an invalid command payload', () => {
    const map = buildMap();
    const ctx = createContext();
    const command = {
      type: 'ADD_RESOURCE_SPAWNER',
      payload: { coordinates: { columnIndex: 0, rowIndex: 0 } },
    } as unknown as HexEngineCommand;

    expect(() => applyCommand(toState(map), command, ctx)).toThrow();
  });
});
