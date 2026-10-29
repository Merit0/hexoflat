import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
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

describe('battle tool hex and stages', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('selects strike targets, glows them and strikes with the chosen hand', () => {
    const store = startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
    const strike: BattleUiState = {
      stage: 'attack',
      mode: 'strike',
      hand: 'right',
      swapHand: 'left',
      hover: null,
      toolAt: null,
    };
    let view = viewOf(strike);
    expect(view.board?.overlay.targets).toEqual(['s1']);
    expect(view.enemies[0].targeted).toBe(true);
    expect(view.hero?.hint?.key).toBe('battle.hint.act.strike');
    expect(view.hero?.hands[0].selected).toBe(true);

    expect(viewOf(strike).board?.tool).toMatchObject({
      hand: 'right',
      toolKey: 'sword',
      action: 'attack',
      targetId: 's1',
      canAfford: true,
    });
    expect(viewOf(strike).hero?.plan).toBe(BATTLE_RULES.strike);
    expect(viewOf().hero?.plan).toBe(0);
    expect(store.act({ kind: 'strike', targetId: 's1', hand: 'right' }, 0)).toBe(true);
    view = viewOf();
    expect(view.hero?.hint).toEqual({ key: 'battle.hint.struck', params: { name: 'Skeleton' } });
    expect(view.enemies[0].hits).toBe(1);
    expect(view.hero?.hands[0].meta?.key).toBe('battle.hand.struck');
    expect(view.board?.tool).toBeNull();
    expect(store.projection?.turnWill).toBe(13);
  });

  it('shows the shield tool only in the block stage and lets the hero switch stage freely', () => {
    const store = startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    const block: BattleUiState = {
      stage: 'block',
      mode: 'block',
      hand: null,
      swapHand: 'left',
      hover: null,
      toolAt: { q: 1, r: 0 },
    };
    expect(viewOf().hero?.stages.map((s) => s.current)).toEqual([false, true, false]);
    expect(viewOf(MOVE).board?.tool).toBeNull();

    const tool = viewOf(block).board?.tool;
    expect(tool).toMatchObject({
      hand: 'left',
      toolKey: 'shield',
      action: 'block',
      price: BATTLE_RULES.shieldPerSide,
    });
    expect(viewOf(block).hero?.plan).toBe(BATTLE_RULES.shieldPerSide);

    expect(store.act({ kind: 'place-shield', hex: { q: 1, r: 0 } }, 0)).toBe(true);
    expect(viewOf(block).board?.tool).toMatchObject({ action: 'unblock', price: 0 });
    expect(viewOf(block).board?.overlay.marks).toContainEqual({
      hex: { q: 1, r: 0 },
      tone: 'shield',
    });
  });

  it('falls back to the weapon hand and offers no action when no foe is beside the hero', () => {
    startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    const strike: BattleUiState = {
      stage: 'attack',
      mode: 'strike',
      hand: 'left',
      swapHand: 'left',
      hover: null,
      toolAt: null,
    };
    expect(viewOf(strike).board?.tool).toMatchObject({ hand: 'right', action: null });
    expect(viewOf().board?.tool).toBeNull();
  });
});
