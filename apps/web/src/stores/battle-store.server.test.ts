import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { projectBattleForViewer } from '@hexoflat/engine/battle/projection';
import { giveTurn, hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { startBattle } from '@hexoflat/engine/battle/start-battle';
import type { BattleReply, BattleRequest } from '@/services/battle/battle-server';
import { useBattleStore } from './battle-store';
import { testDeploy } from './battle-store.fixture';

function enemyTurnProjection() {
  const started = startBattle(
    testDeploy([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]).setup,
  );
  return projectBattleForViewer(giveTurn(started.battle, ['s1', 'hero']), 'heroes');
}

function reply(over: Partial<BattleReply> = {}): BattleReply {
  return { ok: true, code: null, steps: [], events: [], closed: false, result: null, ...over };
}

function bindCounting(answer: () => Promise<BattleReply>) {
  const requests: BattleRequest[] = [];
  useBattleStore().bindBridge({
    request: (request) => {
      requests.push(request);
      return answer();
    },
    onStep: () => {},
    closed: () => Promise.resolve(),
    restore: () => Promise.resolve(null),
  });
  return requests;
}

describe('battle store over the server bridge', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('resumes from the battle view the server returned after a reload (REQ-B4-RST-001)', () => {
    const store = useBattleStore();
    const view = enemyTurnProjection();
    store.restore(
      {
        squadId: 's',
        ambush: false,
        heroAt: { columnIndex: 0, rowIndex: 0 },
        heroIds: ['hero'],
        startItems: {},
      },
      view,
    );
    expect(store.projection).toBe(view);
    expect(store.inBattle).toBe(true);
    expect(store.needsEnemyTurn).toBe(true);
  });

  it('sends one run-enemy-turn and waits for its answer before another (REQ-B4-ENM-001)', async () => {
    const store = useBattleStore();
    store.restore(
      {
        squadId: 's',
        ambush: false,
        heroAt: { columnIndex: 0, rowIndex: 0 },
        heroIds: ['hero'],
        startItems: {},
      },
      enemyTurnProjection(),
    );
    let release: (value: BattleReply) => void = () => {};
    const requests = bindCounting(() => new Promise((resolve) => (release = resolve)));

    const first = store.runEnemyTurn();
    void store.runEnemyTurn();
    void store.runEnemyTurn();
    expect(store.waiting).toBe(true);
    expect(store.needsEnemyTurn).toBe(false);
    expect(requests).toEqual([{ kind: 'run-enemy-turn' }]);

    release(reply());
    await first;
    expect(store.waiting).toBe(false);
  });

  it('does not repeat a refused enemy turn until the state changes', async () => {
    const store = useBattleStore();
    store.restore(
      {
        squadId: 's',
        ambush: false,
        heroAt: { columnIndex: 0, rowIndex: 0 },
        heroIds: ['hero'],
        startItems: {},
      },
      enemyTurnProjection(),
    );
    const requests = bindCounting(() =>
      Promise.resolve(reply({ ok: false, code: 'NOT_YOUR_TURN' })),
    );
    await store.runEnemyTurn();
    expect(store.needsEnemyTurn).toBe(false);
    await store.runEnemyTurn();
    expect(requests).toHaveLength(1);
  });

  it('flags a lost connection without waiting forever (REQ-B4-CON-001)', async () => {
    const store = useBattleStore();
    store.restore(
      {
        squadId: 's',
        ambush: false,
        heroAt: { columnIndex: 0, rowIndex: 0 },
        heroIds: ['hero'],
        startItems: {},
      },
      enemyTurnProjection(),
    );
    bindCounting(() => Promise.resolve(reply({ ok: false, code: 'CONNECTION_LOST' })));
    await store.runEnemyTurn();
    expect(store.waiting).toBe(false);
    expect(store.connectionLost).toBe(true);
  });
});
