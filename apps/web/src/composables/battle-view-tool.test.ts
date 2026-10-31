import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { battleItem } from '@hexoflat/engine/battle/battle-catalogue';
import { giveTurn, hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { useBattleStore } from '@/stores/battle-store';
import { testDeploy } from '@/stores/battle-store.fixture';
import { buildBattleView } from './battle-view';
import type { BattleUiState } from './battle-view-types';

const NAMES: Record<string, string> = { hero: 'Merito', s1: 'Skeleton', s2: 'Skeleton' };
const MOVE: BattleUiState = {
  stage: 'move',
  mode: 'move',
  hand: null,
  swapHand: 'left',
  hover: null,
  toolAt: null,
};

function viewOf(ui: BattleUiState = MOVE) {
  const store = useBattleStore();
  return buildBattleView({
    deploy: store.deploy,
    projection: store.projection,
    localHeroIds: store.localHeroIds,
    lastHeroEvents: store.lastHeroEvents,
    turnStartWill: store.turnStartWill,
    ui,
    rules: BATTLE_RULES,
    nameOf: (id) => NAMES[id] ?? id,
  });
}

function startedOn(order: string[], creatures: BattleCreature[]) {
  const store = useBattleStore();
  store.prepare(testDeploy(creatures), ['hero']);
  store.start();
  store.battle = giveTurn(structuredClone(store.battle!), order);
  return store;
}

const ACTION: BattleUiState = {
  stage: 'action',
  mode: 'strike',
  hand: 'right',
  swapHand: 'left',
  hover: null,
  toolAt: null,
};

describe('battle tool hex and statuses', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('offers Attack with the sword beside a foe, glows the target and shows the plan price', () => {
    const store = startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
    let view = viewOf(ACTION);
    expect(view.board?.overlay.targets).toEqual(['s1']);
    expect(view.enemies[0].targeted).toBe(true);
    expect(view.hero?.hint?.key).toBe('battle.hint.act.strike');
    expect(view.hero?.hands[0].selected).toBe(true);
    expect(view.board?.tool).toMatchObject({
      hand: 'right',
      toolKey: 'sword',
      action: 'attack',
      targetId: 's1',
      canAfford: true,
    });

    expect(store.act({ kind: 'strike', targetId: 's1', hand: 'right' }, 0)).toBe(true);
    view = viewOf();
    expect(view.hero?.hint?.key).toBe('battle.hint.hitTaken');
    expect(view.enemies[0].hits).toBe(0);
    expect(view.hero?.hands[0].meta?.key).toBe('battle.hand.struck');
    expect(view.board?.tool).toBeNull();
    expect(store.projection?.turnWill).toBe(13);
  });

  it('shows no tool in ACTION until a hand is picked by the wheel or a hand row', () => {
    startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
    expect(viewOf({ ...ACTION, hand: null }).board?.tool).toBeNull();
    expect(viewOf({ ...ACTION, hand: 'right' }).board?.tool).toMatchObject({ action: 'attack' });
  });

  it('shows a tool only in ACTION', () => {
    startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    expect(viewOf(MOVE).board?.tool).toBeNull();
    expect(viewOf(ACTION).board?.tool).toMatchObject({ hand: 'right', action: null });
  });

  it('offers no shield action on the hero turn', () => {
    startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    const shield: BattleUiState = { ...ACTION, hand: 'left', toolAt: { q: 1, r: 0 } };
    expect(viewOf(shield).board?.tool).toMatchObject({ toolKey: 'shield', action: null });
  });

  it('offers Block with the shield and Lift once the side is raised, inside the block window', () => {
    const store = startedOn(['s1', 'hero'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
    store.runEnemyTurn(0);
    store.setAnimating(false);
    const shield: BattleUiState = { ...ACTION, hand: 'left', toolAt: { q: 1, r: 0 } };
    expect(viewOf(shield).board?.tool).toMatchObject({
      toolKey: 'shield',
      action: 'block',
      price: 0,
    });

    expect(store.act({ kind: 'place-shield', hex: { q: 1, r: 0 } }, 0)).toBe(true);
    expect(viewOf(shield).board?.tool).toMatchObject({ action: 'unblock', price: 0 });
    expect(viewOf(shield).board?.overlay.marks).toContainEqual({
      hex: { q: 1, r: 0 },
      tone: 'shield',
    });
  });

  it('offers Use with a potion in hand for the use price', () => {
    startedOn(
      ['hero', 's1'],
      [
        hero(
          { q: 0, r: 0 },
          { hp: 3, hands: { right: battleItem('sword'), left: battleItem('health-potion') } },
        ),
        skeleton('s1', { q: 3, r: 0 }),
      ],
    );
    expect(viewOf({ ...ACTION, hand: 'left' }).board?.tool).toMatchObject({
      action: 'use',
      price: battleItem('health-potion').usePrice,
    });
  });

  describe('the cost shows the price of the next action', () => {
    it('shows the attack price only while the tool offers a valid attack', () => {
      startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
      const onFoe = viewOf({ ...ACTION, toolAt: { q: 1, r: 0 } }).hero!;
      expect(onFoe.turnCost).toBe(BATTLE_RULES.strike);
      expect(onFoe.costTooHigh).toBe(false);

      const onEmpty = viewOf({ ...ACTION, toolAt: { q: -1, r: 0 } }).hero!;
      expect(onEmpty.turnCost).toBe(0);
      expect(onEmpty.costTooHigh).toBe(false);
    });

    it('shows the price of the walk to the hovered hex, and nothing once the step is done', () => {
      startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
      const near = viewOf({ ...MOVE, hover: { q: -1, r: 0 } });
      expect(near.hero!.turnCost).toBe(near.board!.preview!.cost);
      expect(near.hero!.costTooHigh).toBe(false);

      expect(viewOf(MOVE).hero!.turnCost).toBe(0);
    });

    it('turns red when the next action costs more Will than the hero has left', () => {
      const store = startedOn(
        ['hero', 's1'],
        [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })],
      );
      store.battle = { ...store.battle!, turnWill: 2 };
      const attack = viewOf({ ...ACTION, toolAt: { q: 1, r: 0 } }).hero!;
      expect(attack.turnCost).toBe(BATTLE_RULES.strike);
      expect(attack.costTooHigh).toBe(true);

      const walk = viewOf({ ...MOVE, hover: { q: -3, r: 0 } }).hero!;
      expect(walk.turnCost).toBeGreaterThan(2);
      expect(walk.costTooHigh).toBe(true);
    });
  });
});
