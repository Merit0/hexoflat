import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { battleItem } from '@hexoflat/engine/battle/battle-catalogue';
import { giveTurn, hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { localBattle } from '@/test-support/local-battle';
import { useBattleStore } from '@/stores/battle-store';
import { testDeploy } from '@/stores/battle-store.fixture';
import { buildBattleView } from './battle-view';
import { battleTapActions } from './battle-board-tap';
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
  const store = localBattle().store;
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

async function startedOn(order: string[], creatures: BattleCreature[]) {
  const store = localBattle().store;
  store.prepare(testDeploy(creatures), ['hero']);
  await store.start();
  localBattle().set(giveTurn(structuredClone(localBattle().state()), order));
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

  it('offers Attack with the sword beside a foe, glows the target and shows the plan price', async () => {
    const store = await startedOn(
      ['hero', 's1'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })],
    );
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

    expect(await localBattle().act({ kind: 'strike', targetId: 's1', hand: 'right' }, 0)).toBe(
      true,
    );
    view = viewOf();
    expect(view.hero?.hint?.key).toBe('battle.hint.hitTaken');
    expect(view.enemies[0].hits).toBe(0);
    expect(view.hero?.hands[0].meta?.key).toBe('battle.hand.struck');
    expect(view.board?.tool).toBeNull();
    expect(store.projection?.turnWill).toBe(13);
  });

  it('shows no tool in ACTION until a hand is picked by the wheel or a hand row', async () => {
    await startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
    expect(viewOf({ ...ACTION, hand: null }).board?.tool).toBeNull();
    expect(viewOf({ ...ACTION, hand: 'right' }).board?.tool).toMatchObject({ action: 'attack' });
  });

  it('shows a tool only in ACTION', async () => {
    await startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    expect(viewOf(MOVE).board?.tool).toBeNull();
    expect(viewOf(ACTION).board?.tool).toMatchObject({ hand: 'right' });
  });

  it('offers no shield action on the hero turn', async () => {
    await startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    const shield: BattleUiState = { ...ACTION, hand: 'left', toolAt: { q: 1, r: 0 } };
    expect(viewOf(shield).board?.tool).toMatchObject({ toolKey: 'shield', action: null });
  });

  it('offers Block with the shield and Lift once the side is raised, inside the block window', async () => {
    const store = await startedOn(
      ['s1', 'hero'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })],
    );
    await localBattle().runEnemyTurn(0);
    store.setAnimating(false);
    const shield: BattleUiState = { ...ACTION, hand: 'left', toolAt: { q: 1, r: 0 } };
    expect(viewOf(shield).board?.tool).toMatchObject({
      toolKey: 'shield',
      action: 'block',
      price: 0,
    });

    expect(await localBattle().act({ kind: 'place-shield', hex: { q: 1, r: 0 } }, 0)).toBe(true);
    expect(viewOf(shield).board?.tool).toMatchObject({ action: 'unblock', price: 0 });
    expect(viewOf(shield).board?.overlay.marks).toContainEqual({
      hex: { q: 1, r: 0 },
      tone: 'shield',
    });
  });

  it('keeps the shield tool hex after the last shield and offers Lift over a placed one', async () => {
    const store = await startedOn(
      ['s1', 'hero'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })],
    );
    await localBattle().runEnemyTurn(0);
    store.setAnimating(false);
    const ring = store.projection!.pending.flatMap((p) => p.ring);
    for (const hex of ring) await localBattle().act({ kind: 'place-shield', hex }, 0);
    const placed = store.projection!.placedShields[0];
    const shield: BattleUiState = { ...ACTION, hand: 'left', toolAt: placed };
    expect(viewOf(shield).board?.tool).toMatchObject({ toolKey: 'shield', action: 'unblock' });
  });

  it('offers Use with a potion in hand for the use price', async () => {
    await startedOn(
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
    it('shows the attack price only while the tool offers a valid attack', async () => {
      await startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
      const onFoe = viewOf({ ...ACTION, toolAt: { q: 1, r: 0 } }).hero!;
      expect(onFoe.turnCost).toBe(BATTLE_RULES.strike);
      expect(onFoe.costTooHigh).toBe(false);

      const onEmpty = viewOf({ ...ACTION, toolAt: { q: -1, r: 0 } }).hero!;
      expect(onEmpty.turnCost).toBe(0);
      expect(onEmpty.costTooHigh).toBe(false);
    });

    it('shows the price of the walk to the hovered hex, and nothing once the step is done', async () => {
      await startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
      const near = viewOf({ ...MOVE, hover: { q: -1, r: 0 } });
      expect(near.hero!.turnCost).toBe(near.board!.preview!.cost);
      expect(near.hero!.costTooHigh).toBe(false);

      expect(viewOf(MOVE).hero!.turnCost).toBe(0);
    });

    it('turns red when the next action costs more Will than the hero has left', async () => {
      const store = await startedOn(
        ['hero', 's1'],
        [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })],
      );
      localBattle().set({ ...localBattle().state(), turnWill: 2 });
      const attack = viewOf({ ...ACTION, toolAt: { q: 1, r: 0 } }).hero!;
      expect(attack.turnCost).toBe(BATTLE_RULES.strike);
      expect(attack.costTooHigh).toBe(true);

      const walk = viewOf({ ...MOVE, hover: { q: -3, r: 0 } }).hero!;
      expect(walk.turnCost).toBeGreaterThan(2);
      expect(walk.costTooHigh).toBe(true);
    });
  });
});

describe('auto-selecting the closest foe', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const CLOSE_AND_FAR = [
    hero({ q: 0, r: 0 }),
    skeleton('s1', { q: 1, r: 0 }),
    skeleton('s2', { q: 0, r: 3 }),
  ];

  it('selects the only foe in a 1 on 1 fight', async () => {
    await startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    expect(viewOf(MOVE).enemies.map((r) => r.selected)).toEqual([true]);
  });

  it('selects the closest of several foes and aims the weapon at it', async () => {
    await startedOn(['hero', 's1', 's2'], CLOSE_AND_FAR);
    const view = viewOf(ACTION);
    expect(view.enemies.find((r) => r.id === 's1')?.selected).toBe(true);
    expect(view.enemies.find((r) => r.id === 's2')?.selected).toBe(false);
    expect(view.board?.tool).toMatchObject({
      action: 'attack',
      targetId: 's1',
      at: { q: 1, r: 0 },
    });
    expect(view.board?.overlay.marks).toContainEqual({ hex: { q: 1, r: 0 }, tone: 'selected' });
  });

  it('lets the hero reselect another foe', async () => {
    await startedOn(['hero', 's1', 's2'], CLOSE_AND_FAR);
    const view = viewOf({ ...ACTION, selectedId: 's2' });
    expect(view.enemies.find((r) => r.id === 's2')?.selected).toBe(true);
    expect(view.enemies.find((r) => r.id === 's1')?.selected).toBe(false);
    expect(view.board?.tool).toMatchObject({ targetId: 's2' });
  });

  it('refuses to attack an unselected foe with the tool hex while another foe is chosen', async () => {
    await startedOn(
      ['hero', 's1', 's2'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 }), skeleton('s2', { q: 0, r: 1 })],
    );
    const onOther = viewOf({ ...ACTION, selectedId: 's1', toolAt: { q: 0, r: 1 } }).board?.tool;
    expect(onOther).toMatchObject({ at: { q: 0, r: 1 }, action: null, targetId: null });
    const onChosen = viewOf({ ...ACTION, selectedId: 's1', toolAt: { q: 1, r: 0 } }).board?.tool;
    expect(onChosen).toMatchObject({ action: 'attack', targetId: 's1' });
  });

  it('keeps the tool hex on the hovered hex instead of jumping to the target', async () => {
    await startedOn(['hero', 's1', 's2'], CLOSE_AND_FAR);
    const hovered = viewOf({ ...ACTION, toolAt: { q: -1, r: 0 } }).board?.tool;
    expect(hovered).toMatchObject({ at: { q: -1, r: 0 }, action: null });
  });

  it('falls back to the closest foe when the selection is not a living foe', async () => {
    await startedOn(['hero', 's1', 's2'], CLOSE_AND_FAR);
    const view = viewOf({ ...ACTION, selectedId: 'hero' });
    expect(view.enemies.find((r) => r.id === 's1')?.selected).toBe(true);
  });

  it('keeps moving free without any manual selection', async () => {
    await startedOn(['hero', 's1', 's2'], CLOSE_AND_FAR);
    expect(
      battleTapActions({
        projection: useBattleStore().projection,
        localHeroIds: ['hero'],
        mode: 'move',
        hex: { q: -1, r: 0 },
        rules: BATTLE_RULES,
      }),
    ).toEqual([{ kind: 'move', hex: { q: -1, r: 0 } }]);
    expect(viewOf({ ...MOVE, hover: { q: -1, r: 0 } }).board?.preview).not.toBeNull();
  });
});

describe('decoy shields around the selected foe', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const shieldBearer = () =>
    skeleton('s1', { q: 2, r: 0 }, { hands: { right: null, left: battleItem('wooden-shield') } });
  const decoys = (ui: BattleUiState) =>
    viewOf(ui)
      .board!.overlay.marks.filter((m) => m.tone === 'shield')
      .map((m) => `${m.hex.q},${m.hex.r}`)
      .sort();

  it('fills every free hex around the selected foe, hiding the real ones', async () => {
    await startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), shieldBearer()]);
    const around = decoys(MOVE);
    expect(around.length).toBeGreaterThan(2);
    expect(around).not.toContain('2,0');
  });

  it('shows nothing around a foe without a shield', async () => {
    await startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })]);
    expect(decoys(MOVE)).toEqual([]);
  });

  it('gives way to the revealed real shields after the attack', async () => {
    await startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), shieldBearer()]);
    const store = localBattle().store;
    const real = [{ q: 3, r: 0 }];
    const view = buildBattleView({
      deploy: store.deploy,
      projection: store.projection,
      localHeroIds: store.localHeroIds,
      lastHeroEvents: store.lastHeroEvents,
      turnStartWill: store.turnStartWill,
      ui: MOVE,
      rules: BATTLE_RULES,
      nameOf: (id) => id,
      revealedShields: real,
    });
    const marks = view.board!.overlay.marks.filter((m) => m.tone === 'shield');
    expect(marks.map((m) => `${m.hex.q},${m.hex.r}`)).toEqual(['3,0']);
  });
});
