import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import type { BattleCreature, BattleHex } from '@hexoflat/engine/battle/battle-state';
import { giveTurn, hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { hexNeighbours } from '@hexoflat/engine/battle/hex-battle-geom';
import { useBattleStore } from '@/stores/battle-store';
import { testDeploy } from '@/stores/battle-store.fixture';
import { battleTapActions } from './battle-board-tap';
import { buildBattleView } from './battle-view';
import type { BattleUiState } from './battle-view-types';

const NAMES: Record<string, string> = { hero: 'Merito', s1: 'Skeleton', s2: 'Skeleton' };
const MOVE: BattleUiState = { mode: 'move', hand: null, swapHand: 'left', hover: null };

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

function tap(hex: BattleHex, ui: BattleUiState = MOVE): boolean {
  const store = useBattleStore();
  const actions = battleTapActions({
    projection: store.projection,
    localHeroIds: store.localHeroIds,
    mode: ui.mode,
    hand: ui.hand,
    hex,
    rules: BATTLE_RULES,
  });
  return actions.length > 0 && store.actAll(actions, 0);
}

function startedOn(order: string[], creatures: BattleCreature[]) {
  const store = useBattleStore();
  store.prepare(testDeploy(creatures), ['hero']);
  store.start();
  store.battle = giveTurn(structuredClone(store.battle!), order);
  return store;
}

describe('battle view', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('shows the deploy card with the enemies before START BATTLE', () => {
    const store = useBattleStore();
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

  it('plays a full turn: defend with a shield, act, undo a step, end turn into WAIT', () => {
    const store = startedOn(
      ['s1', 'hero', 's2'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 }), skeleton('s2', { q: -3, r: 3 })],
    );
    store.runEnemyTurn(0);

    let view = viewOf();
    expect(view.hero?.state).toBe('defend');
    expect(view.hero?.row.hits).toBe(1);
    expect(view.hero?.defend).toMatchObject({
      strikes: 1,
      attacker: 'Skeleton',
      placed: 0,
      capacity: 2,
    });
    expect(view.hero?.defend?.canBlock).toBe(false);
    expect(view.hero?.will).toBe(20);

    const ring = store.projection!.pending[0].ring;
    expect(tap(ring[0])).toBe(true);
    expect(tap(ring[1])).toBe(true);
    view = viewOf();
    expect(view.hero?.defend).toMatchObject({ placed: 2, canBlock: true });
    expect(view.hero?.will).toBe(12);
    expect(view.board?.overlay.marks.filter((m) => m.tone === 'shield')).toHaveLength(2);

    expect(tap(ring[1])).toBe(true);
    expect(viewOf().hero?.defend?.placed).toBe(1);

    expect(store.act({ kind: 'confirm-block' }, 0)).toBe(true);
    view = viewOf();
    expect(view.hero?.state).toBe('act');
    expect(['battle.hint.blocked', 'battle.hint.hitTaken']).toContain(view.hero?.hint?.key);
    const results = view.board!.overlay.marks.filter((m) =>
      ['blocked', 'hit', 'dodged'].includes(m.tone),
    );
    expect(results).toHaveLength(1);
    expect(view.hero?.actions.map((a) => a.id)).toEqual(['strike', 'push', 'pull', 'swap']);

    const willBefore = view.hero!.will;
    const self = store.projection!.creatures.find((c) => c.id === 'hero')!;
    const step = hexNeighbours(self.pos)
      .map((hex) => viewOf({ ...MOVE, hover: hex }).board!.preview)
      .find((preview) => preview?.reachable && preview.path.length === 1)!;
    expect(step.cost).toBeGreaterThan(0);
    expect(tap(step.path[0])).toBe(true);
    view = viewOf();
    expect(view.hero?.hint?.key).toBe('battle.hint.moved');
    expect(view.hero?.canUndo).toBe(true);
    expect(view.hero!.will).toBeLessThan(willBefore);

    expect(store.act({ kind: 'undo-step' }, 0)).toBe(true);
    view = viewOf();
    expect(view.hero?.hint?.key).toBe('battle.hint.undone');
    expect(view.hero?.will).toBe(willBefore);
    expect(view.hero?.stanceNote).toBe(Math.min(8, willBefore));

    expect(store.act({ kind: 'end-turn' }, 0)).toBe(true);
    view = viewOf();
    expect(view.hero?.state).toBe('wait');
    expect(view.hero?.wait).toMatchObject({ name: 'Skeleton', stance: Math.min(8, willBefore) });
    expect(store.needsEnemyTurn).toBe(true);
  });

  it('selects strike targets, glows them and strikes with the chosen hand', () => {
    const store = startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
    const strike: BattleUiState = { mode: 'strike', hand: 'right', swapHand: 'left', hover: null };
    let view = viewOf(strike);
    expect(view.board?.overlay.targets).toEqual(['s1']);
    expect(view.enemies[0].targeted).toBe(true);
    expect(view.hero?.hint?.key).toBe('battle.hint.act.strike');
    expect(view.hero?.hands[0].selected).toBe(true);

    expect(tap({ q: 1, r: 0 }, strike)).toBe(true);
    view = viewOf();
    expect(view.hero?.hint).toEqual({ key: 'battle.hint.struck', params: { name: 'Skeleton' } });
    expect(view.enemies[0].hits).toBe(1);
    expect(view.hero?.hands[0].meta?.key).toBe('battle.hand.struck');
    expect(view.hero?.actions[0].disabled).toBe(true);
    expect(store.projection?.turnWill).toBe(13);
  });

  it('explains a refusal in the hint line', () => {
    startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }, { bag: [] }), skeleton('s1', { q: 3, r: 0 })]);
    const store = useBattleStore();
    store.act({ kind: 'swap-item', hand: 'left', bagIndex: 0 }, 0);
    expect(viewOf().hero?.hint).toMatchObject({ key: 'battle.reject.NO_SUCH_ITEM' });
    store.act({ kind: 'strike', targetId: 's1', hand: 'right' }, 0);
    expect(viewOf().hero?.hint).toMatchObject({ key: 'battle.reject.NOT_ADJACENT' });
  });

  it('builds the initiative strip and marks next, done and fallen rows', () => {
    const store = startedOn(
      ['s2', 'hero', 's1'],
      [
        hero({ q: 0, r: 0 }),
        skeleton('s1', { q: 3, r: 0 }),
        skeleton('s2', { q: -3, r: 0 }, { hp: 0 }),
      ],
    );
    store.battle = { ...store.battle!, turnIndex: 1, activeId: 'hero', phase: 'act', turnWill: 20 };
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

  it('locks the board and shows the task while one is open', () => {
    const store = startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    store.battle = {
      ...store.battle!,
      board: { ...store.battle!.board, '1,0': 'saw' },
    };
    expect(tap({ q: 1, r: 0 })).toBe(true);
    const view = viewOf();
    expect(view.task?.kind).toBe('saw');
    expect(view.task?.options).toHaveLength(4);
    expect(view.task?.question).toMatch(/^\d+ [×÷] \d+$/);
    expect(
      battleTapActions({
        projection: store.projection,
        localHeroIds: ['hero'],
        mode: 'move',
        hand: null,
        hex: { q: -1, r: 0 },
        rules: BATTLE_RULES,
      }),
    ).toEqual([]);

    expect(store.act({ kind: 'task-timeout' }, 10_000)).toBe(true);
    expect(viewOf().task).toBeNull();
    expect(viewOf().hero?.hint?.key).toBe('battle.hint.sawCut');
  });

  it('shows the victory card once the last enemy falls', () => {
    const store = startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
    store.battle = { ...store.battle!, phase: 'ended', outcome: 'victory' };
    const view = viewOf();
    expect(view.stage).toBe('ended');
    expect(view.hero?.state).toBe('victory');
  });
});
