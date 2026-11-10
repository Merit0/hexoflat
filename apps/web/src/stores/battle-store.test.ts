import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import {
  giveTurn,
  hero,
  hexagonBoard,
  rightAnswer,
  skeleton,
} from '@hexoflat/engine/battle/battle-test-setup';
import { localBattle } from '@/test-support/local-battle';
import { useBattleStore } from './battle-store';
import { testDeploy } from './battle-store.fixture';

async function startedOn(order: string[], creatures: BattleCreature[], board = hexagonBoard(3)) {
  const store = localBattle().store;
  store.prepare(testDeploy(creatures, board), ['hero']);
  await store.start();
  localBattle().set(giveTurn(structuredClone(localBattle().state()), order));
  store.takeEvents();
  return store;
}

describe('battle store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('opens on prepare, starts only on START BATTLE and closes cleanly', async () => {
    const store = localBattle().store;
    expect(store.isOpen).toBe(false);
    store.prepare(testDeploy([hero({ q: -2, r: 0 }), skeleton('s1', { q: 2, r: 0 })]), ['hero']);
    expect(store.isOpen).toBe(true);
    expect(store.projection).toBeNull();

    await store.start();
    expect(store.projection?.round).toBe(1);
    expect(store.takeEvents().map((e) => e.type)).toContain('BATTLE_STARTED');
    expect(store.takeEvents()).toEqual([]);

    store.close();
    expect(store.isOpen).toBe(false);
    expect(store.projection).toBeNull();
  });

  it('acts for the local hero on its turn and keeps the batch for the hint line', async () => {
    const store = await startedOn(
      ['hero', 's1'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })],
    );
    expect(await localBattle().act({ kind: 'move', hex: { q: 1, r: 0 } }, 10)).toBe(true);
    expect(store.lastHeroEvents.map((e) => e.type)).toEqual(['CREATURE_MOVED']);
    expect(store.projection?.turnWill).toBe(19);

    expect(await localBattle().act({ kind: 'move', hex: { q: 3, r: 0 } }, 10)).toBe(false);
    expect(store.lastHeroEvents[0].type).toBe('BATTLE_REJECTED');
    expect(store.projection?.turnWill).toBe(19);
  });

  it('keeps hero clicks while the hero walks, but holds the enemy turn until the board is still', async () => {
    const store = await startedOn(
      ['hero', 's1'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })],
    );
    store.setAnimating(true);
    expect(store.inputLocked).toBe(false);
    expect(await localBattle().act({ kind: 'move', hex: { q: 1, r: 0 } }, 10)).toBe(true);
    expect(await localBattle().act({ kind: 'move', hex: { q: 2, r: 0 } }, 10)).toBe(true);
    expect(store.projection?.turnWill).toBe(18);
    store.setAnimating(false);
    expect(await localBattle().act({ kind: 'end-turn' }, 10)).toBe(true);
    expect(store.needsEnemyTurn).toBe(true);
    store.setAnimating(true);
    expect(store.needsEnemyTurn).toBe(false);
    store.close();
    expect(store.animating).toBe(false);
  });

  it('locks hero input while an enemy turn plays and frees it afterwards', async () => {
    const store = await startedOn(
      ['s1', 'hero'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })],
    );
    await localBattle().runEnemyTurn(10);
    store.setAnimating(true);
    expect(store.inputLocked).toBe(true);
    store.lastHeroEvents = [];
    expect(await localBattle().act({ kind: 'end-turn' }, 10)).toBe(false);
    expect(store.lastHeroEvents).toEqual([]);
    store.setAnimating(false);
    expect(store.inputLocked).toBe(false);
    await localBattle().act({ kind: 'end-turn' }, 10);
    expect(store.lastHeroEvents.length).toBeGreaterThan(0);
  });

  it('refuses to act for anyone when an enemy holds the turn', async () => {
    const store = await startedOn(
      ['s1', 'hero'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })],
    );
    expect(store.needsEnemyTurn).toBe(true);
    expect(await localBattle().act({ kind: 'end-turn' })).toBe(false);
    expect(store.lastHeroEvents).toEqual([]);
  });

  it('walks a path step by step and stops at the first refusal', async () => {
    const store = await startedOn(
      ['hero', 's1'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })],
    );
    const ok = await localBattle().actAll([
      { kind: 'move', hex: { q: 1, r: 0 } },
      { kind: 'move', hex: { q: 3, r: 0 } },
      { kind: 'move', hex: { q: 1, r: 1 } },
    ]);
    expect(ok).toBe(false);
    expect(store.lastHeroEvents.map((e) => e.type)).toEqual(['CREATURE_MOVED', 'BATTLE_REJECTED']);
    expect(store.projection?.creatures.find((c) => c.id === 'hero')?.pos).toEqual({ q: 1, r: 0 });
  });

  it('runs the enemy turn and hides where the enemy struck from in the queue', async () => {
    const store = await startedOn(
      ['s1', 'hero'],
      [hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })],
    );
    await localBattle().runEnemyTurn(5);
    const events = store.takeEvents();
    const dealt = events.find((e) => e.type === 'STRIKE_DEALT');
    expect(dealt).toBeDefined();
    expect((dealt!.payload as { fromHex: unknown }).fromHex).toBeNull();
    expect(store.projection?.activeId).toBe('hero');
    expect(store.projection?.phase).toBe('defend');
    expect(store.turnStartWill).toBe(20);
    expect(store.needsEnemyTurn).toBe(false);
  });

  it('lets the hero answer a task that opened on the enemy turn', async () => {
    const board = hexagonBoard(3, { '-1,0': 'saw' });
    const king = skeleton('k', { q: 1, r: 0 }, { kind: 'skeleton-king', force: 2, weight: 3 });
    const store = await startedOn(['k', 'hero'], [hero({ q: 0, r: 0 }), king], board);
    await localBattle().runEnemyTurn(0);
    expect(store.projection?.task?.creatureId).toBe('hero');
    expect(store.needsEnemyTurn).toBe(false);

    expect(
      await localBattle().act(
        { kind: 'answer-task', option: rightAnswer(localBattle().state()) },
        100,
      ),
    ).toBe(true);
    expect(store.projection?.task).toBeUndefined();
    expect(store.needsEnemyTurn).toBe(store.projection?.activeId === 'k');
  });
});
