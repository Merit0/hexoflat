import { describe, expect, it, vi } from 'vitest';
import {
  applyCommand,
  type HexEngineActionContext,
  type HexEngineState,
} from '../commands/apply-command';
import { deserializeState, serializeState } from '../commands/snapshot';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import { ContentDefinitionSchema, CONTENT } from '../content';
import { MapRegistry } from '../registry/world-map-registry';
import { applyKnowledgeCommand } from './reducer';
import { createKnowledgeState } from './state';
import { grantWill } from './will';
import { KNOWLEDGE_RULES, stepCost } from './math';
import { willZoneCharges } from './will-zone';
import type { KnowledgeContext } from './commands';

const paid: KnowledgeContext = {
  locationKey: 'silesia',
  willZone: 'paid',
  mapId: 'world',
  combatActive: false,
  moving: false,
  atBook: false,
};

function engineCtx(): HexEngineActionContext {
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
    hero: { hero: { name: 'Hero', maxHealth: 100, currentHealth: 50 }, healHero: vi.fn() },
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

function actionState(key: THexobjectKey, will: number, context: KnowledgeContext = paid) {
  const map = new HexMapBuilder().name('will').width(1).height(1).build();
  const tile = map.tiles[0];
  tile.hexobject = HexObjectFactory.create(key, tile.coordinates);
  const knowledge = createKnowledgeState('hero');
  knowledge.current = will;
  const state: HexEngineState = { map, heroes: {}, knowledge, knowledgeContext: context };
  const start = (actionType: EHexActionType) =>
    applyCommand(
      state,
      {
        type: 'START_HEX_ACTION',
        payload: {
          heroId: 'hero',
          coordinates: tile.coordinates,
          actionType,
          toolKey: HEXOBJECT_KEYS.HAND,
          now: 0,
        },
      },
      engineCtx(),
    ).events;
  return { state, knowledge, start };
}

describe('Will economy', () => {
  it('starts a fresh hero with the starting Will, below capacity', () => {
    const fresh = createKnowledgeState('hero');
    expect(fresh.current).toBe(KNOWLEDGE_RULES.startingWill);
    expect(fresh.current).toBeLessThan(fresh.capacity);
  });

  it('charges steps in paid zones only, never in free zones or combat', () => {
    expect(willZoneCharges({ willZone: 'paid', combatActive: false })).toBe(true);
    expect(willZoneCharges({ willZone: 'free', combatActive: false })).toBe(false);
    expect(willZoneCharges({ willZone: 'paid', combatActive: true })).toBe(false);
    expect(MapRegistry.get('camping').willZone).toBe('free');
    expect(MapRegistry.get('silesia').willZone ?? 'paid').toBe('paid');
    expect(stepCost(paid)).toBe(KNOWLEDGE_RULES.worldStepCost);
  });

  it('emits WILL_SPENT for a paid step and WILL_REJECTED when Will is short', () => {
    const state = createKnowledgeState('hero');
    state.current = 1;
    const step = (): ReturnType<typeof applyKnowledgeCommand> =>
      applyKnowledgeCommand(
        state,
        {
          type: 'KNOWLEDGE',
          payload: {
            heroId: 'hero',
            revision: state.revision,
            action: { kind: 'step', target: { columnIndex: 1, rowIndex: 2 } },
          },
        },
        paid,
      );
    expect(step()).toContainEqual({
      type: 'WILL_SPENT',
      payload: { heroId: 'hero', amount: 1, reason: 'step', ref: '1:2', balanceAfter: 0 },
    });
    const rejected = step();
    expect(rejected[0].type).toBe('KNOWLEDGE_REJECTED');
    expect(rejected).toContainEqual({
      type: 'WILL_REJECTED',
      payload: { heroId: 'hero', reason: 'INSUFFICIENT_WILL', ref: '1:2' },
    });
    expect(state.current).toBe(0);
  });
});

describe('Will-priced actions', () => {
  it('rejects a priced action with too little Will without changing anything', () => {
    const { knowledge, start } = actionState(HEXOBJECT_KEYS.CAVE_ENTRANCE, 1);
    const before = JSON.stringify(knowledge);
    const events = start(EHexActionType.ENTER);
    expect(events.map((e) => e.type)).toEqual(['WILL_REJECTED', 'HEX_ACTION_START_REJECTED']);
    expect(events[0].payload).toMatchObject({ reason: 'INSUFFICIENT_WILL' });
    expect(JSON.stringify(knowledge)).toBe(before);
  });

  it('charges the content price of entering the cave together with the action', () => {
    const { knowledge, start } = actionState(HEXOBJECT_KEYS.CAVE_ENTRANCE, 2);
    const events = start(EHexActionType.ENTER);
    expect(events).toContainEqual({
      type: 'WILL_SPENT',
      payload: {
        heroId: 'hero',
        amount: 2,
        reason: 'entry',
        ref: 'ENTER:0:0',
        balanceAfter: 0,
      },
    });
    expect(events.some((e) => e.type === 'HEX_ACTION_STARTED')).toBe(true);
    expect(knowledge.current).toBe(0);
  });

  it('does not charge leaving the cave or any action in a free zone', () => {
    const exit = actionState(HEXOBJECT_KEYS.CAVE_EXIT, 0);
    const exitEvents = exit.start(EHexActionType.ENTER);
    expect(exitEvents.some((e) => e.type === 'HEX_ACTION_STARTED')).toBe(true);
    expect(exitEvents.some((e) => e.type.startsWith('WILL_'))).toBe(false);
    const camp = actionState(HEXOBJECT_KEYS.FIREPLACE, 0, { ...paid, willZone: 'free' });
    expect(camp.start(EHexActionType.USE).some((e) => e.type === 'HEX_ACTION_STARTED')).toBe(true);
    const combat = actionState(HEXOBJECT_KEYS.FIREPLACE, 0, { ...paid, combatActive: true });
    expect(combat.start(EHexActionType.USE).some((e) => e.type === 'HEX_ACTION_STARTED')).toBe(
      true,
    );
  });

  it('does not spend Will when the action itself is refused', () => {
    const { knowledge, start } = actionState(HEXOBJECT_KEYS.CHEST, 5);
    const events = start(EHexActionType.OPEN);
    expect(events[0].type).toBe('HEX_ACTION_START_REJECTED');
    expect(knowledge.current).toBe(5);
  });

  it('grants Will only through grantWill, capped by capacity', () => {
    const state = createKnowledgeState('hero');
    state.current = state.capacity - 3;
    const events = grantWill(state, 10, { kind: 'hall', ref: 's1' });
    expect(events).toEqual([
      {
        type: 'WILL_GRANTED',
        payload: {
          heroId: 'hero',
          amount: 3,
          source: { kind: 'hall', ref: 's1' },
          balanceAfter: state.capacity,
        },
      },
    ]);
    expect(grantWill(state, 5, { kind: 'item', ref: 'x' })).toEqual([]);
  });

  it('opens the return path when Will is below the step price', () => {
    const state = createKnowledgeState('hero');
    state.current = stepCost(paid) - 1;
    const events = applyKnowledgeCommand(
      state,
      {
        type: 'KNOWLEDGE',
        payload: {
          heroId: 'hero',
          revision: 0,
          action: { kind: 'start', mode: 'return', seed: 'r' },
        },
      },
      paid,
    );
    expect(events[0].type).toBe('KNOWLEDGE_CHANGED');
    state.current = stepCost(paid);
    state.session = null;
    expect(
      applyKnowledgeCommand(
        state,
        {
          type: 'KNOWLEDGE',
          payload: {
            heroId: 'hero',
            revision: state.revision,
            action: { kind: 'start', mode: 'return', seed: 'r2' },
          },
        },
        paid,
      )[0].type,
    ).toBe('KNOWLEDGE_REJECTED');
  });

  it('loads an old snapshot payload and keeps priced content valid', () => {
    const map = new HexMapBuilder().name('old').width(1).height(1).build();
    const payload = serializeState({ map, heroes: {} });
    expect(deserializeState(payload, 0).knowledge).toBeUndefined();
    const cave = CONTENT[HEXOBJECT_KEYS.CAVE_ENTRANCE];
    for (const bad of [-1, 6, 1.5]) {
      const actions = { ENTER: { ...cave.actions!.ENTER, willCost: bad } };
      expect(ContentDefinitionSchema.safeParse({ ...cave, actions }).success).toBe(false);
    }
  });
});

describe('stale Hall lessons', () => {
  it('drops a Hall lesson bound to a rebuilt camp map when the book is opened again', () => {
    const state = createKnowledgeState('hero');
    const camp: KnowledgeContext = {
      ...paid,
      locationKey: 'camping',
      willZone: 'free',
      mapId: 'camp-1',
      atBook: true,
    };
    const send = (context: KnowledgeContext, kind: 'start' | 'open') =>
      applyKnowledgeCommand(
        state,
        {
          type: 'KNOWLEDGE',
          payload: {
            heroId: 'hero',
            revision: state.revision,
            action: kind === 'start' ? { kind, mode: 'hall', seed: 's' } : { kind },
          },
        },
        context,
      )[0].type;
    expect(send(camp, 'start')).toBe('KNOWLEDGE_CHANGED');
    expect(send({ ...camp, mapId: 'camp-2' }, 'open')).toBe('KNOWLEDGE_CHANGED');
    expect(state.session).toBeNull();
  });
});
