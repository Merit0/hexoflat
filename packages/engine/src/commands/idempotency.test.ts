import { describe, expect, it, vi } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import type HexMapModel from '../map/models/hex-map-model';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import type { HeroState } from '../hero-movement/hero-state';
import { APPLIED_COMMAND_LOG_LIMIT } from './applied-command-log';
import { applyCommand, createEngineState, type HexEngineActionContext } from './apply-command';
import type { HexEngineState } from './engine-state';
import type { HexEngineCommand } from './hex-engine-commands';
import { deserializeState, serializeState } from './snapshot';

/**
 * E0's idempotency guarantee: a repeated `commandId` is a no-op that returns
 * the first run's result. The design leans on it everywhere — a client
 * retrying after a dropped socket must not gather the resource twice, and a
 * co-op peer replaying must not fire World Pulse a second time.
 *
 * Every command in the union is covered, because a guarantee that holds for
 * four of five commands is not a guarantee.
 */

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
    hero: { hero: { name: 'Hero', maxHealth: 100, currentHealth: 100 }, healHero: vi.fn() },
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

const HERO_START = { columnIndex: 0, rowIndex: 0 };

function buildHero(): HeroState {
  return { id: 'hero-1', controlledBy: null, coordinates: { ...HERO_START }, heroSteps: 0 };
}

function buildMap(): HexMapModel {
  const map = new HexMapBuilder().name('idempotency').width(3).height(3).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

function buildState(): HexEngineState {
  const hero = buildHero();
  return createEngineState({
    map: buildMap(),
    heroes: { [hero.id]: hero },
    seed: 'idempotency',
  });
}

/** A command per type, plus the state setup each needs to actually do something. */
const CASES: Array<{
  name: HexEngineCommand['type'];
  prepare?: (state: HexEngineState) => void;
  command: (commandId: string) => HexEngineCommand;
}> = [
  {
    name: 'START_HEX_ACTION',
    prepare: (state) => {
      const tile = state.map.getTileAt(HERO_START)!;
      tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, tile.coordinates);
    },
    command: (commandId) => ({
      commandId,
      actorId: 'user-1',
      type: 'START_HEX_ACTION',
      payload: {
        heroId: 'hero-1',
        coordinates: HERO_START,
        actionType: EHexActionType.CUT,
        toolKey: HEXOBJECT_KEYS.AXE,
        now: 0,
      },
    }),
  },
  {
    name: 'FINISH_PENDING_ACTIONS',
    prepare: (state) => {
      const tile = state.map.getTileAt(HERO_START)!;
      tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, tile.coordinates);
      tile.pendingAction = {
        type: EHexActionType.CUT,
        startedAt: 0,
        endsAt: 500,
        hexobjectKey: HEXOBJECT_KEYS.TREE,
        cancelled: false,
      };
    },
    command: (commandId) => ({
      commandId,
      actorId: 'user-1',
      type: 'FINISH_PENDING_ACTIONS',
      payload: { now: 1000 },
    }),
  },
  {
    name: 'WORLD_TICK',
    prepare: (state) => {
      state.map.getTileAt({ columnIndex: 1, rowIndex: 1 })!.resourceSpawner = {
        proto: { hexobjectKey: HEXOBJECT_KEYS.ROCK },
        regrowMs: 60_000,
        nextSpawnAt: 500,
        enabled: true,
      };
    },
    command: (commandId) => ({
      commandId,
      actorId: 'user-1',
      type: 'WORLD_TICK',
      payload: { now: 1000 },
    }),
  },
  {
    name: 'ADD_RESOURCE_SPAWNER',
    command: (commandId) => ({
      commandId,
      actorId: 'user-1',
      type: 'ADD_RESOURCE_SPAWNER',
      payload: {
        heroId: 'hero-1',
        coordinates: { columnIndex: 1, rowIndex: 1 },
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.TREE },
      },
    }),
  },
  {
    name: 'MOVE_HERO',
    command: (commandId) => ({
      commandId,
      actorId: 'user-1',
      type: 'MOVE_HERO',
      payload: { heroId: 'hero-1', target: { columnIndex: 1, rowIndex: 0 } },
    }),
  },
];

/** Everything a duplicate must leave untouched, in a comparable form. */
function observableState(state: HexEngineState) {
  return JSON.stringify({
    map: state.map.toJSON(),
    heroes: state.heroes,
    rngState: state.rngState,
    stateVersion: state.stateVersion,
  });
}

describe.each(CASES)('duplicate commandId: $name', ({ prepare, command }) => {
  it('returns the first run’s events and changes nothing the second time', () => {
    const state = buildState();
    prepare?.(state);
    const ctx = createContext();

    const first = applyCommand(state, command('cmd-1'), ctx);
    const afterFirst = observableState(state);

    const second = applyCommand(state, command('cmd-1'), ctx);

    expect(second.events).toEqual(first.events);
    expect(second.replayed).toBe(true);
    expect(first.replayed).toBe(false);
    expect(observableState(state)).toBe(afterFirst);
  });

  it('bumps stateVersion once, not twice', () => {
    const state = buildState();
    prepare?.(state);
    const ctx = createContext();

    applyCommand(state, command('cmd-1'), ctx);
    applyCommand(state, command('cmd-1'), ctx);

    expect(state.stateVersion).toBe(1);
  });

  it('does not re-run the handler’s side effects on the ports', () => {
    const state = buildState();
    prepare?.(state);
    const ctx = createContext();

    applyCommand(state, command('cmd-1'), ctx);
    const callsAfterFirst = [
      ctx.gathering.add,
      ctx.inventory.putToInventory,
      ctx.heroToolStore.lockTool,
      ctx.heroToolStore.unlockTool,
    ].map((fn) => (fn as ReturnType<typeof vi.fn>).mock.calls.length);

    applyCommand(state, command('cmd-1'), ctx);

    expect(
      [
        ctx.gathering.add,
        ctx.inventory.putToInventory,
        ctx.heroToolStore.lockTool,
        ctx.heroToolStore.unlockTool,
      ].map((fn) => (fn as ReturnType<typeof vi.fn>).mock.calls.length),
    ).toEqual(callsAfterFirst);
  });

  it('still runs when the same command is re-issued under a new commandId', () => {
    const state = buildState();
    prepare?.(state);
    const ctx = createContext();

    applyCommand(state, command('cmd-1'), ctx);
    const second = applyCommand(state, command('cmd-2'), ctx);

    expect(second.replayed).toBe(false);
    expect(state.stateVersion).toBe(2);
  });
});

describe('expectedStateVersion', () => {
  const tick = (commandId: string, expectedStateVersion?: number): HexEngineCommand => ({
    commandId,
    actorId: 'user-1',
    ...(expectedStateVersion === undefined ? {} : { expectedStateVersion }),
    type: 'WORLD_TICK',
    payload: { now: 0 },
  });

  it('runs the command when the version matches', () => {
    const state = buildState();

    const result = applyCommand(state, tick('cmd-1', 0), createContext());

    expect(result.events.map((e) => e.type)).toEqual(['WORLD_TICKED']);
    expect(state.stateVersion).toBe(1);
  });

  it('refuses a stale version with an event instead of throwing', () => {
    const state = buildState();
    const ctx = createContext();
    applyCommand(state, tick('cmd-1'), ctx);

    const result = applyCommand(state, tick('cmd-2', 0), ctx);

    expect(result.events).toEqual([
      {
        type: 'COMMAND_REJECTED',
        payload: {
          commandId: 'cmd-2',
          commandType: 'WORLD_TICK',
          reason: 'STALE_STATE_VERSION',
          expectedStateVersion: 0,
          actualStateVersion: 1,
        },
      },
    ]);
    expect(state.stateVersion).toBe(1);
  });

  it('does not record a refused command, so a corrected retry can reuse the id', () => {
    const state = buildState();
    const ctx = createContext();
    applyCommand(state, tick('cmd-1'), ctx);

    applyCommand(state, tick('cmd-2', 0), ctx);
    const retried = applyCommand(state, tick('cmd-2', 1), ctx);

    expect(retried.events.map((e) => e.type)).toEqual(['WORLD_TICKED']);
    expect(state.stateVersion).toBe(2);
  });

  it('is optional — a command without it never goes stale', () => {
    const state = buildState();
    const ctx = createContext();

    applyCommand(state, tick('cmd-1'), ctx);
    const result = applyCommand(state, tick('cmd-2'), ctx);

    expect(result.events.map((e) => e.type)).toEqual(['WORLD_TICKED']);
  });
});

describe('applied-command log', () => {
  const tick = (commandId: string): HexEngineCommand => ({
    commandId,
    actorId: 'user-1',
    type: 'WORLD_TICK',
    payload: { now: 0 },
  });

  it('survives a snapshot round trip, so a retry across a save is still a no-op', () => {
    const state = buildState();
    const ctx = createContext();
    const first = applyCommand(state, tick('cmd-1'), ctx);

    const restored = deserializeState(serializeState(state), 0);
    const replayed = applyCommand(restored, tick('cmd-1'), ctx);

    expect(replayed.replayed).toBe(true);
    expect(replayed.events).toEqual(first.events);
    expect(restored.stateVersion).toBe(state.stateVersion);
  });

  it('stops growing at the cap instead of bloating every autosave', () => {
    const state = buildState();
    const ctx = createContext();

    for (let i = 0; i < APPLIED_COMMAND_LOG_LIMIT + 20; i += 1) {
      applyCommand(state, tick(`cmd-${i}`), ctx);
    }

    expect(state.appliedCommands).toHaveLength(APPLIED_COMMAND_LOG_LIMIT);
    expect(state.appliedCommands[0].commandId).toBe('cmd-20');
  });

  it('drops the oldest entries first, so recent retries keep working', () => {
    const state = buildState();
    const ctx = createContext();

    for (let i = 0; i < APPLIED_COMMAND_LOG_LIMIT + 1; i += 1) {
      applyCommand(state, tick(`cmd-${i}`), ctx);
    }

    // Evicted: runs again for real. Still remembered: replayed.
    expect(applyCommand(state, tick('cmd-0'), ctx).replayed).toBe(false);
    expect(applyCommand(state, tick(`cmd-${APPLIED_COMMAND_LOG_LIMIT}`), ctx).replayed).toBe(true);
  });
});
