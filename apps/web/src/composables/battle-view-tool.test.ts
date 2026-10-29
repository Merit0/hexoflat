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
    expect(view.hero?.plan).toBe(BATTLE_RULES.strike);
    expect(viewOf().hero?.plan).toBe(0);

    expect(store.act({ kind: 'strike', targetId: 's1', hand: 'right' }, 0)).toBe(true);
    view = viewOf();
    expect(view.hero?.hint).toEqual({ key: 'battle.hint.struck', params: { name: 'Skeleton' } });
    expect(view.enemies[0].hits).toBe(1);
    expect(view.hero?.hands[0].meta?.key).toBe('battle.hand.struck');
    expect(view.board?.tool).toBeNull();
    expect(store.projection?.turnWill).toBe(13);
  });

  it('has two statuses and shows a tool only in ACTION', () => {
    startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    expect(viewOf(MOVE).hero?.stages).toEqual([
      { id: 'action', current: false },
      { id: 'move', current: true },
    ]);
    expect(viewOf(MOVE).board?.tool).toBeNull();
    expect(viewOf(ACTION).board?.tool).toMatchObject({ hand: 'right', action: null });
  });

  it('offers Block with the shield and Lift once the side is guarded', () => {
    const store = startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    const shield: BattleUiState = { ...ACTION, hand: 'left', toolAt: { q: 1, r: 0 } };
    expect(viewOf(shield).board?.tool).toMatchObject({
      toolKey: 'shield',
      action: 'block',
      price: BATTLE_RULES.shieldPerSide,
    });
    expect(viewOf(shield).hero?.plan).toBe(BATTLE_RULES.shieldPerSide);

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
      price: BATTLE_RULES.use,
    });
  });
});
