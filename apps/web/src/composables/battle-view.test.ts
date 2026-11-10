import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import type { BattleCreature, BattleHex } from '@hexoflat/engine/battle/battle-state';
import { giveTurn, hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { hexNeighbours } from '@hexoflat/engine/battle/hex-battle-geom';
import { localBattle } from '@/test-support/local-battle';
import { useBattleStore } from '@/stores/battle-store';
import { testDeploy } from '@/stores/battle-store.fixture';
import { battleTapActions } from './battle-board-tap';
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

async function tap(hex: BattleHex, ui: BattleUiState = MOVE): Promise<boolean> {
  const store = localBattle().store;
  const actions = battleTapActions({
    projection: store.projection,
    localHeroIds: store.localHeroIds,
    mode: ui.mode,
    hex,
    rules: BATTLE_RULES,
  });
  return actions.length > 0 && (await localBattle().actAll(actions, 0));
}

async function startedOn(order: string[], creatures: BattleCreature[]) {
  const store = localBattle().store;
  store.prepare(testDeploy(creatures), ['hero']);
  await store.start();
  localBattle().set(giveTurn(structuredClone(localBattle().state()), order));
  return store;
}

describe('battle view', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('shows the deploy card with the enemies before START BATTLE', () => {
    const store = localBattle().store;
    store.prepare(
      testDeploy([
        hero({ q: -2, r: 0 }),
        skeleton('s1', { q: 2, r: 0 }),
        skeleton('s2', { q: 2, r: 1 }),
      ]),
      ['hero'],
    );
    const view = viewOf();
    expect(view.stage).toBe('deploy');
    expect(view.deploy?.enemies.map((e) => e.name)).toEqual(['Skeleton', 'Skeleton']);
    expect(view.hero).toBeNull();
    expect(view.board?.banner).toBeNull();
    expect(view.board?.scene.creatures).toHaveLength(3);
  });

  it('plays a full turn: defend with a shield, act, undo a step, end turn into WAIT', async () => {
    const store = await startedOn(
      ['s1', 'hero', 's2'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 }), skeleton('s2', { q: -3, r: 3 })],
    );
    await localBattle().runEnemyTurn(0);

    let view = viewOf();
    expect(view.hero?.state).toBe('defend');
    expect(view.hero?.row.hits).toBe(1);
    expect(view.hero?.defend).toMatchObject({
      strikes: 1,
      attacker: 'Skeleton',
      placed: 0,
      capacity: 2,
    });
    expect(view.hero?.will).toBe(0);
    expect(store.projection?.reaction).toMatchObject({ stage: 'block', attackerId: 's1' });

    const ring = store.projection!.pending[0].ring;
    expect(await tap(ring[0])).toBe(true);
    expect(await tap(ring[1])).toBe(true);
    view = viewOf();
    expect(view.hero?.defend).toMatchObject({ placed: 2 });
    expect(view.hero?.will).toBe(0);
    expect(view.board?.overlay.marks.filter((m) => m.tone === 'shield')).toHaveLength(2);

    expect(await tap(ring[1])).toBe(true);
    expect(viewOf().hero?.defend?.placed).toBe(1);

    expect(await localBattle().act({ kind: 'reaction-timeout' }, 0)).toBe(true);
    expect(viewOf().hero?.state).toBe('wait');
    expect(store.projection?.reaction?.stage).toBe('aim');
    await localBattle().runEnemyTurn(0);
    store.setAnimating(false);
    view = viewOf();
    expect(view.hero?.state).toBe('act');
    expect(store.projection?.reaction).toBeUndefined();
    expect(view.hero?.actions.map((a) => a.id)).toEqual(['push']);

    const willBefore = view.hero!.will;
    const self = store.projection!.creatures.find((c) => c.id === 'hero')!;
    const step = hexNeighbours(self.pos)
      .map((hex) => viewOf({ ...MOVE, hover: hex, selectedId: 's1' }).board!.preview)
      .find((preview) => preview?.reachable && preview.path.length === 1)!;
    expect(step.cost).toBeGreaterThan(0);
    expect(await tap(step.path[0])).toBe(true);
    view = viewOf();
    expect(view.hero?.turnCost).toBe(0);
    expect(view.hero?.canUndo).toBe(true);
    expect(view.hero!.will).toBeLessThan(willBefore);

    expect(await localBattle().act({ kind: 'undo-step' }, 0)).toBe(true);
    view = viewOf();
    expect(view.hero?.turnCost).toBe(0);
    expect(view.hero?.will).toBe(willBefore);

    expect(await localBattle().act({ kind: 'end-turn' }, 0)).toBe(true);
    view = viewOf();
    expect(view.hero?.state).toBe('wait');
    expect(view.hero?.wait).toMatchObject({ name: 'Skeleton', stance: Math.min(8, willBefore) });
    expect(store.needsEnemyTurn).toBe(true);
  });

  it('explains a refusal in the hint line', async () => {
    await startedOn(
      ['hero', 's1'],
      [hero({ q: 0, r: 0 }, { bag: [] }), skeleton('s1', { q: 3, r: 0 })],
    );
    const store = localBattle().store;
    await localBattle().act({ kind: 'swap-item', hand: 'left', bagIndex: 0 }, 0);
    expect(viewOf().hero?.hint).toMatchObject({ key: 'battle.reject.NO_SUCH_ITEM' });
    localBattle().set({ ...localBattle().state(), turnWill: 8 });
    await localBattle().act({ kind: 'strike', targetId: 's1', hand: 'right' }, 0);
    expect(viewOf().hero?.hint).toMatchObject({ key: 'battle.reject.NOT_ADJACENT' });
  });

  it('builds the initiative strip and marks next, done and fallen rows', async () => {
    const store = await startedOn(
      ['s2', 'hero', 's1'],
      [
        hero({ q: 0, r: 0 }),
        skeleton('s1', { q: 3, r: 0 }),
        skeleton('s2', { q: -3, r: 0 }, { hp: 0 }),
      ],
    );
    localBattle().set({
      ...localBattle().state(),
      turnIndex: 1,
      activeId: 'hero',
      phase: 'act',
      turnWill: 20,
    });
    const view = viewOf();
    expect(view.chips.map((c) => [c.id, c.state])).toEqual([
      ['s2', 'fallen'],
      ['hero', 'active'],
      ['s1', 'wait'],
    ]);
    expect(view.enemies.find((r) => r.id === 's1')?.tags).toEqual(['next']);
    expect(view.enemies.find((r) => r.id === 's2')?.tags).toEqual(['fallen']);
    expect(view.enemiesLeft).toBe(1);
    expect(view.hero?.row.tags).toEqual(['yourTurn']);
    expect(view.board?.banner).toMatchObject({ actor: 'Merito', will: 20, round: 1 });
  });

  it('locks the board and shows the task while one is open', async () => {
    const store = await startedOn(
      ['hero', 's1'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })],
    );
    localBattle().set({
      ...localBattle().state(),
      board: { ...localBattle().state().board, '1,0': 'saw' },
    });
    expect(await tap({ q: 1, r: 0 })).toBe(true);
    const view = viewOf();
    expect(view.task?.kind).toBe('saw');
    expect(view.task?.options).toHaveLength(4);
    expect(view.task?.question).toMatch(/^\d+ [×÷] \d+$/);
    expect(
      battleTapActions({
        projection: store.projection,
        localHeroIds: ['hero'],
        mode: 'move',
        hex: { q: -1, r: 0 },
        rules: BATTLE_RULES,
      }),
    ).toEqual([]);

    expect(await localBattle().act({ kind: 'task-timeout' }, 10_000)).toBe(true);
    expect(viewOf().task).toBeNull();
    expect(viewOf().hero?.hint?.key).toBe('battle.hint.sawCut');
  });

  it('shows the victory card once the last enemy falls', async () => {
    const store = await startedOn(
      ['hero', 's1'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })],
    );
    localBattle().set({ ...localBattle().state(), phase: 'ended', outcome: 'victory' });
    const view = viewOf();
    expect(view.stage).toBe('ended');
    expect(view.hero?.state).toBe('victory');
  });
});
