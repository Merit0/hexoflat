import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { projectBattleForViewer, type BattleProjection } from '@hexoflat/engine/battle/projection';
import { giveTurn, hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { startBattle } from '@hexoflat/engine/battle/start-battle';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import type { BattleReply, BattleRequest } from '@/services/battle/battle-reply';
import { useBattleStore, type BattleStep } from './battle-store';
import { testDeploy } from './battle-store.fixture';

const deploy = testDeploy([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);

function turnOf(order: string[]): BattleProjection {
  const started = startBattle(deploy.setup);
  return projectBattleForViewer(giveTurn(started.battle, order), 'heroes');
}

function collecting(): BattleProjection {
  return {
    ...turnOf(['hero', 's1']),
    phase: 'ended',
    outcome: 'victory',
    collect: { graves: [], items: [] },
  };
}

const engagement: Engagement = {
  squadId: 's',
  ambush: false,
  heroAt: { columnIndex: 0, rowIndex: 0 },
  heroIds: ['hero'],
  startItems: {},
};

const moved: DomainEvent[] = [
  { type: 'CREATURE_MOVED', payload: { creatureId: 'hero', path: [] } },
];

function stepReply(battle: BattleProjection | null, over: Partial<BattleReply> = {}): BattleReply {
  return {
    ok: true,
    code: null,
    steps: [{ battle, events: moved }],
    events: moved,
    closed: false,
    result: null,
    ...over,
  };
}

interface Pending {
  request: BattleRequest;
  answer(reply: BattleReply): void;
}

function bindDeferred() {
  const pending: Pending[] = [];
  const stepped: BattleStep[] = [];
  const closed: BattleReply[] = [];
  useBattleStore().bindBridge({
    request: (request) => new Promise((resolve) => pending.push({ request, answer: resolve })),
    onStep: (step) => stepped.push(step),
    closed: (reply) => {
      closed.push(reply);
      return Promise.resolve();
    },
    restore: () => Promise.resolve(null),
  });
  return { pending, stepped, closed };
}

function snapshot() {
  const store = useBattleStore();
  return {
    deploy: store.deploy,
    engagement: store.engagement,
    projection: store.projection,
    localHeroIds: [...store.localHeroIds],
    lastHeroEvents: store.lastHeroEvents,
    queue: store.queue,
    turnStartWill: store.turnStartWill,
    waiting: store.waiting,
    connectionLost: store.connectionLost,
    revealedShields: store.revealedShields,
    needsEnemyTurn: store.needsEnemyTurn,
  };
}

describe('battle store: replies of a closed or restored battle (M8)', () => {
  beforeEach(() => setActivePinia(createPinia()));

  describe('characterization', () => {
    it('close() clears the battle and the waiting flag', () => {
      const store = useBattleStore();
      store.prepare(deploy, ['hero'], turnOf(['hero', 's1']));
      store.engage(engagement);
      store.close();
      expect(snapshot()).toMatchObject({
        deploy: null,
        engagement: null,
        projection: null,
        localHeroIds: [],
        queue: [],
        waiting: false,
      });
      expect(store.inBattle).toBe(false);
    });

    it('restore() replaces the battle with the saved engagement and view', () => {
      const store = useBattleStore();
      store.prepare(deploy, ['hero'], turnOf(['hero', 's1']));
      const view = turnOf(['s1', 'hero']);
      store.restore(engagement, view);
      expect(store.engagement).toBe(engagement);
      expect(store.projection).toBe(view);
      expect(store.deploy).toBeNull();
      expect(store.localHeroIds).toEqual([]);
    });

    it('a step reply sets the projection, queues events and feeds the bridge in order', async () => {
      const store = useBattleStore();
      const { pending, stepped } = bindDeferred();
      store.prepare(deploy, ['hero'], turnOf(['hero', 's1']));
      const acting = store.act({ kind: 'move', hex: { q: 1, r: 0 } });
      expect(store.waiting).toBe(true);
      const after = turnOf(['s1', 'hero']);
      pending[0].answer(stepReply(after));
      expect(await acting).toBe(true);
      expect(store.projection).toBe(after);
      expect(store.queue).toEqual(moved);
      expect(store.lastHeroEvents).toEqual(moved);
      expect(stepped).toEqual([{ battle: after, events: moved }]);
      expect(store.waiting).toBe(false);
    });
  });

  it('REQ-1: a step reply that arrives after close() is dropped', async () => {
    const store = useBattleStore();
    const { pending, stepped } = bindDeferred();
    store.prepare(deploy, ['hero'], turnOf(['hero', 's1']));
    store.engage(engagement);
    const acting = store.act({ kind: 'move', hex: { q: 1, r: 0 } });
    store.close();
    const closedState = snapshot();

    pending[0].answer(stepReply(turnOf(['s1', 'hero'])));

    expect(await acting).toBe(false);
    expect(snapshot()).toEqual(closedState);
    expect(store.takeEvents()).toEqual([]);
    expect(stepped).toEqual([]);
  });

  it('REQ-1: an enemy-turn reply after close() leaves no refused turn behind', async () => {
    const store = useBattleStore();
    const { pending } = bindDeferred();
    const view = turnOf(['s1', 'hero']);
    store.restore(engagement, view);
    const running = store.runEnemyTurn();
    store.close();
    pending[0].answer(stepReply(null, { ok: false, code: 'NOT_YOUR_TURN', steps: [] }));
    await running;

    store.restore(engagement, view);
    expect(store.needsEnemyTurn).toBe(true);
  });

  it('REQ-2: a step reply that arrives after restore() is dropped', async () => {
    const store = useBattleStore();
    const { pending, stepped } = bindDeferred();
    store.prepare(deploy, ['hero'], turnOf(['hero', 's1']));
    const acting = store.act({ kind: 'move', hex: { q: 1, r: 0 } });
    const restored = turnOf(['s1', 'hero']);
    store.restore(engagement, restored);
    const restoredState = snapshot();

    pending[0].answer(stepReply(turnOf(['hero', 's1'])));

    expect(await acting).toBe(false);
    expect(snapshot()).toEqual(restoredState);
    expect(store.projection).toBe(restored);
    expect(store.takeEvents()).toEqual([]);
    expect(stepped).toEqual([]);
  });

  it('REQ-2: a reply sent before restore() does not clear the waiting flag of the restored battle', async () => {
    const store = useBattleStore();
    const { pending } = bindDeferred();
    store.prepare(deploy, ['hero'], turnOf(['hero', 's1']));
    const stale = store.act({ kind: 'move', hex: { q: 1, r: 0 } });
    store.restore(engagement, turnOf(['s1', 'hero']));
    const running = store.runEnemyTurn();
    expect(store.waiting).toBe(true);

    pending[0].answer(stepReply(turnOf(['hero', 's1'])));
    await stale;
    expect(store.waiting).toBe(true);

    const after = turnOf(['hero', 's1']);
    pending[1].answer(stepReply(after));
    await running;
    expect(store.waiting).toBe(false);
    expect(store.projection).toBe(after);
  });

  it('REQ-3: a reply of the current battle still applies', async () => {
    const store = useBattleStore();
    const { pending, stepped } = bindDeferred();
    store.restore(engagement, turnOf(['s1', 'hero']));
    store.prepare(deploy, ['hero'], store.projection);
    const running = store.runEnemyTurn();
    const after = turnOf(['hero', 's1']);
    pending[0].answer(stepReply(after));
    await running;

    expect(store.projection).toBe(after);
    expect(store.takeEvents()).toEqual(moved);
    expect(stepped).toHaveLength(1);
    expect(store.waiting).toBe(false);
  });

  it('REQ-4: two replies in flight, close between them: neither applies', async () => {
    const store = useBattleStore();
    const { pending, stepped, closed } = bindDeferred();
    store.prepare(deploy, ['hero'], collecting());
    store.engage(engagement);
    const acting = store.act({ kind: 'pickup-loot', hex: { q: 1, r: 0 } });
    const leaving = store.leave();
    expect(pending.map((p) => p.request.kind)).toEqual(['hero', 'close']);
    store.close();
    const closedState = snapshot();

    pending[1].answer(stepReply(null, { closed: true }));
    pending[0].answer(stepReply(collecting()));

    expect(await leaving).toBe(false);
    expect(await acting).toBe(false);
    expect(snapshot()).toEqual(closedState);
    expect(store.takeEvents()).toEqual([]);
    expect(stepped).toEqual([]);
    expect(closed).toEqual([]);
  });

  it('a multi-step path closed mid-way writes no hero events into the closed store', async () => {
    const store = useBattleStore();
    const { pending } = bindDeferred();
    store.prepare(deploy, ['hero'], turnOf(['hero', 's1']));
    const path = store.actAll([
      { kind: 'move', hex: { q: 1, r: 0 } },
      { kind: 'move', hex: { q: 2, r: 0 } },
    ]);
    pending[0].answer(stepReply(turnOf(['hero', 's1'])));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    store.close();
    pending[1].answer(stepReply(turnOf(['hero', 's1'])));

    expect(await path).toBe(false);
    expect(store.lastHeroEvents).toEqual([]);
  });

  it('a BATTLE_OPEN start does not install the server view after close()', async () => {
    const store = useBattleStore();
    let releaseView: (view: BattleProjection | null) => void = () => {};
    let restoreAsked: () => void = () => {};
    const asked = new Promise<void>((resolve) => (restoreAsked = resolve));
    store.bindBridge({
      request: () =>
        Promise.resolve(stepReply(null, { ok: false, code: 'BATTLE_OPEN', steps: [] })),
      onStep: () => {},
      closed: () => Promise.resolve(),
      restore: () => {
        restoreAsked();
        return new Promise((resolve) => (releaseView = resolve));
      },
    });
    store.prepare(deploy, ['hero']);
    const starting = store.start();
    await asked;
    store.close();
    releaseView(turnOf(['hero', 's1']));

    expect(await starting).toBe(false);
    expect(store.projection).toBeNull();
  });
});
