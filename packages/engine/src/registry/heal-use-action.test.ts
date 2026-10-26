import { describe, expect, it, vi } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import type HexMapModel from '../map/models/hex-map-model';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS, type THexobjectKey } from './hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import {
  applyCommand,
  type HexEngineActionContext,
  type HexEngineState,
} from '../commands/apply-command';
import type { HexEngineCommand } from '../commands/hex-engine-commands';

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
    const state: HexEngineState = { map, heroes: {} };

    const start: HexEngineCommand = {
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
      type: 'FINISH_PENDING_ACTIONS',
      payload: { now: 10_000 },
    };
    applyCommand(state, finish, ctx);

    expect(ctx.hero.healHero).toHaveBeenCalledWith(amountPerTick);
  });
});

describe('healing respects the gear-raised maximum', () => {
  function heroWith(current: number, base: number, effective: number): HexEngineActionContext {
    const ctx = createContext();
    ctx.hero.hero = {
      name: 'Hero',
      maxHealth: base,
      currentHealth: current,
      getEffectiveMaxHealth: () => effective,
    };
    return ctx;
  }

  function startAtFireplace(ctx: HexEngineActionContext) {
    const map = buildMap();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.FIREPLACE, tile.coordinates);
    return applyCommand(
      { map, heroes: {} },
      {
        type: 'START_HEX_ACTION',
        payload: {
          heroId: 'hero-1',
          coordinates: tile.coordinates,
          actionType: EHexActionType.USE,
          toolKey: HEXOBJECT_KEYS.HAND,
          now: 0,
        },
      },
      ctx,
    ).events;
  }

  it('still heals a hero at the base maximum when a shield raised the cap', () => {
    const events = startAtFireplace(heroWith(3, 3, 4));
    expect(events[0]).toMatchObject({ type: 'HEX_ACTION_STARTED' });
  });

  it('reports full health only at the raised maximum', () => {
    const events = startAtFireplace(heroWith(4, 3, 4));
    expect(events[0]).toMatchObject({
      type: 'HEX_ACTION_START_REJECTED',
      payload: { message: 'Health is already full.' },
    });
  });

  it('keeps resting while health is below the raised maximum', () => {
    const map = buildMap();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.FIREPLACE, tile.coordinates);
    const ctx = heroWith(3, 3, 4);
    ctx.heroToolStore.isDragging = true;
    ctx.heroToolStore.activeTool = HEXOBJECT_KEYS.HAND;
    ctx.heroToolStore.hover = tile.coordinates;
    const state: HexEngineState = { map, heroes: {} };
    applyCommand(
      state,
      {
        type: 'START_HEX_ACTION',
        payload: {
          heroId: 'hero-1',
          coordinates: tile.coordinates,
          actionType: EHexActionType.USE,
          toolKey: HEXOBJECT_KEYS.HAND,
          now: 0,
        },
      },
      ctx,
    );
    applyCommand(state, { type: 'FINISH_PENDING_ACTIONS', payload: { now: 10_000 } }, ctx);
    expect(tile.pendingAction).toMatchObject({ startedAt: 10_000 });
  });
});
