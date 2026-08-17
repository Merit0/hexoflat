import { describe, expect, it, vi } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import type HexMapModel from '../map/models/hex-map-model';
import { EHexActionType } from '../enums/hex-action-type';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { HeroState } from '../hero-movement/hero-state';
import {
  applyCommand,
  createEngineState,
  type HexEngineActionContext,
  type HexEngineState,
} from './apply-command';
import { HEX_ENGINE_COMMAND_SCHEMAS, type HexEngineCommand } from './hex-engine-commands';

// Every command now carries an envelope (commandId/actorId). Ids must be
// unique per dispatch or the applied-command log would treat the second one
// as a retry and replay the first result instead of running it.
let commandCounter = 0;
function nextCommandId(): string {
  commandCounter += 1;
  return `cmd-${commandCounter}`;
}

/**
 * Characterization tests — written *before* the E0 dispatch refactor and left
 * untouched by it. Where `apply-command.test.ts` pins what each command does
 * to the world, this file pins the dispatcher's own contract: which command
 * types are reachable, what each one emits, that validation runs before any
 * handler side effect, and that `state` comes back by reference.
 *
 * If the switch-to-registry conversion ever changes one of these, it changed
 * behaviour and not just shape.
 */

function buildMap(): HexMapModel {
  const map = new HexMapBuilder().name('characterization').width(3).height(3).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

function buildHero(): HeroState {
  return {
    id: 'hero-1',
    controlledBy: null,
    coordinates: { columnIndex: 0, rowIndex: 0 },
    heroSteps: 0,
  };
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

/** One valid command per type, plus the event type each is expected to emit. */
const DISPATCH_CASES: Array<{
  command: HexEngineCommand;
  expectedEventType: string;
}> = [
  {
    command: {
      commandId: nextCommandId(),
      actorId: 'test-actor',
      type: 'START_HEX_ACTION',
      payload: {
        heroId: 'hero-1',
        coordinates: { columnIndex: 0, rowIndex: 0 },
        actionType: EHexActionType.CUT,
        toolKey: HEXOBJECT_KEYS.AXE,
        now: 0,
      },
    },
    // No hexobject on the tile — the rejection path is still a dispatch.
    expectedEventType: 'HEX_ACTION_START_REJECTED',
  },
  {
    command: {
      commandId: nextCommandId(),
      actorId: 'test-actor',
      type: 'FINISH_PENDING_ACTIONS',
      payload: { now: 0 },
    },
    expectedEventType: 'HEX_ACTIONS_FINISHED',
  },
  {
    command: {
      commandId: nextCommandId(),
      actorId: 'test-actor',
      type: 'WORLD_TICK',
      payload: { now: 0 },
    },
    expectedEventType: 'WORLD_TICKED',
  },
  {
    command: {
      commandId: nextCommandId(),
      actorId: 'test-actor',
      type: 'ADD_RESOURCE_SPAWNER',
      payload: {
        heroId: 'hero-1',
        coordinates: { columnIndex: 0, rowIndex: 0 },
        hexobject: { hexobjectKey: HEXOBJECT_KEYS.TREE },
      },
    },
    expectedEventType: 'RESOURCE_SPAWNER_ADDED',
  },
  {
    command: {
      commandId: nextCommandId(),
      actorId: 'test-actor',
      type: 'MOVE_HERO',
      payload: { heroId: 'hero-1', target: { columnIndex: 1, rowIndex: 0 } },
    },
    expectedEventType: 'HERO_MOVED',
  },
];

function toState(map: HexMapModel): HexEngineState {
  const hero = buildHero();
  return createEngineState({ map, heroes: { [hero.id]: hero }, seed: 'characterization' });
}

describe('applyCommand dispatch (characterization)', () => {
  it('covers every command type registered in HEX_ENGINE_COMMAND_SCHEMAS', () => {
    const dispatched = DISPATCH_CASES.map((c) => c.command.type).sort();

    expect(dispatched).toEqual(Object.keys(HEX_ENGINE_COMMAND_SCHEMAS).sort());
  });

  it.each(DISPATCH_CASES)(
    'dispatches $command.type and emits $expectedEventType',
    ({ command, expectedEventType }) => {
      const result = applyCommand(toState(buildMap()), command, createContext());

      expect(result.events.map((e) => e.type)).toEqual([expectedEventType]);
    },
  );

  it.each(DISPATCH_CASES)(
    'returns the same state object it was given ($command.type)',
    ({ command }) => {
      const state = toState(buildMap());

      const result = applyCommand(state, command, createContext());

      expect(result.state).toBe(state);
      expect(result.state.map).toBe(state.map);
    },
  );

  it('validates the payload before running any handler side effect', () => {
    const state = toState(buildMap());
    const ctx = createContext();
    const invalid = {
      commandId: nextCommandId(),
      actorId: 'test-actor',
      type: 'START_HEX_ACTION',
      payload: {
        heroId: 'hero-1',
        coordinates: { columnIndex: 0, rowIndex: 0 },
        actionType: 'NOT_A_REAL_ACTION',
        toolKey: HEXOBJECT_KEYS.AXE,
        now: 0,
      },
    } as unknown as HexEngineCommand;

    expect(() => applyCommand(state, invalid, ctx)).toThrow();
    expect(ctx.heroToolStore.lockTool).not.toHaveBeenCalled();
    expect(state.map.tiles.every((t) => t.pendingAction === null)).toBe(true);
  });

  it('throws for a command type that has no registered schema', () => {
    const state = toState(buildMap());
    const unknown = { type: 'NOT_A_COMMAND', payload: {} } as unknown as HexEngineCommand;

    expect(() => applyCommand(state, unknown, createContext())).toThrow();
  });
});
