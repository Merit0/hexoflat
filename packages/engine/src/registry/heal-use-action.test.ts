import { describe, expect, it, vi } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import type HexMapModel from '../map/models/hex-map-model';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS, type THexobjectKey } from './hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import {
  applyCommand,
  createEngineState,
  type HexEngineActionContext,
  type HexEngineState,
} from '../commands/apply-command';
import type { HexEngineCommand } from '../commands/hex-engine-commands';

// Every command now carries an envelope (commandId/actorId). Ids must be
// unique per dispatch or the applied-command log would treat the second one
// as a retry and replay the first result instead of running it.
let commandCounter = 0;
function nextCommandId(): string {
  commandCounter += 1;
  return `cmd-${commandCounter}`;
}

function buildMap(): HexMapModel {
  return new HexMapBuilder().name('heal-test').width(1).height(1).build();
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
    // Half health — both heal sources below should be usable and should heal.
    hero: {
      hero: { name: 'Hero', maxHealth: 100, currentHealth: 50 },
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

/**
 * Both FIREPLACE and HEALING_SPRING run through the exact same USE
 * start/finish code (action-starters/finishers-registry.ts) — neither is
 * special-cased there. Only their content entries differ (`heal.amountPerTick`
 * is 1 vs 2), which is what this test is actually asserting.
 */
describe.each<{ key: THexobjectKey; amountPerTick: number }>([
  { key: HEXOBJECT_KEYS.FIREPLACE, amountPerTick: 1 },
  { key: HEXOBJECT_KEYS.HEALING_SPRING, amountPerTick: 2 },
])('USE on a heal object ($key)', ({ key, amountPerTick }) => {
  it(`starts and finishes healing for ${amountPerTick} HP/tick, driven purely by its content entry`, () => {
    const map = buildMap();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(key, tile.coordinates);
    const ctx = createContext();
    const state: HexEngineState = createEngineState({ map, seed: 'heal-use-action-test' });

    const start: HexEngineCommand = {
      commandId: nextCommandId(),
      actorId: 'test-actor',
      type: 'START_HEX_ACTION',
      payload: {
        heroId: 'hero-1',
        coordinates: tile.coordinates,
        actionType: EHexActionType.USE,
        toolKey: HEXOBJECT_KEYS.HAND,
        now: 0,
      },
    };
    const startResult = applyCommand(state, start, ctx);

    expect(startResult.events).toEqual([
      {
        type: 'HEX_ACTION_STARTED',
        payload: { coordinates: tile.coordinates, actionType: EHexActionType.USE, endsAt: 10_000 },
      },
    ]);
    expect(tile.pendingAction).toMatchObject({ meta: { healAmount: amountPerTick } });

    const finish: HexEngineCommand = {
      commandId: nextCommandId(),
      actorId: 'test-actor',
      type: 'FINISH_PENDING_ACTIONS',
      payload: { now: 10_000 },
    };
    applyCommand(state, finish, ctx);

    expect(ctx.hero.healHero).toHaveBeenCalledWith(amountPerTick);
  });
});
