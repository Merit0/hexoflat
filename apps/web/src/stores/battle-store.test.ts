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
import { useBattleStore } from './battle-store';
import { testDeploy } from './battle-store.fixture';

function startedOn(order: string[], creatures: BattleCreature[], board = hexagonBoard(3)) {
  const store = useBattleStore();
  store.prepare(testDeploy(creatures, board), ['hero']);
  store.start();
  store.battle = giveTurn(structuredClone(store.battle!), order);
  store.takeEvents();
  return store;
}

describe('battle store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('opens on prepare, starts only on START BATTLE and closes cleanly', () => {
    const store = useBattleStore();
    expect(store.isOpen).toBe(false);
    store.prepare(testDeploy([hero({ q: -2, r: 0 }), skeleton('s1', { q: 2, r: 0 })]), ['hero']);
    expect(store.isOpen).toBe(true);
    expect(store.projection).toBeNull();

    store.start();
    expect(store.projection?.round).toBe(1);
    expect(store.takeEvents().map((e) => e.type)).toContain('BATTLE_STARTED');
    expect(store.takeEvents()).toEqual([]);

    store.close();
    expect(store.isOpen).toBe(false);
    expect(store.battle).toBeNull();
  });

  it('acts for the local hero on its turn and keeps the batch for the hint line', () => {
    const store = startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    expect(store.act({ kind: 'move', hex: { q: 1, r: 0 } }, 10)).toBe(true);
    expect(store.lastHeroEvents.map((e) => e.type)).toEqual(['CREATURE_MOVED']);
    expect(store.projection?.turnWill).toBe(19);

    expect(store.act({ kind: 'move', hex: { q: 3, r: 0 } }, 10)).toBe(false);
    expect(store.lastHeroEvents[0].type).toBe('BATTLE_REJECTED');
    expect(store.projection?.turnWill).toBe(19);
  });

  it('locks hero input and enemy turns while the board animates', () => {
    const store = startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    store.setAnimating(true);
    expect(store.act({ kind: 'move', hex: { q: 1, r: 0 } }, 10)).toBe(false);
    expect(store.projection?.turnWill).toBe(20);
    store.setAnimating(false);
    expect(store.act({ kind: 'end-turn' }, 10)).toBe(true);
    expect(store.needsEnemyTurn).toBe(true);
    store.setAnimating(true);
    expect(store.needsEnemyTurn).toBe(false);
    store.close();
    expect(store.animating).toBe(false);
  });

  it('refuses to act for anyone when an enemy holds the turn', () => {
    const store = startedOn(['s1', 'hero'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    expect(store.needsEnemyTurn).toBe(true);
    expect(store.act({ kind: 'end-turn' })).toBe(false);
    expect(store.lastHeroEvents).toEqual([]);
  });

  it('walks a path step by step and stops at the first refusal', () => {
    const store = startedOn(['hero', 's1'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]);
    const ok = store.actAll([
      { kind: 'move', hex: { q: 1, r: 0 } },
      { kind: 'move', hex: { q: 3, r: 0 } },
      { kind: 'move', hex: { q: 1, r: 1 } },
    ]);
    expect(ok).toBe(false);
    expect(store.lastHeroEvents.map((e) => e.type)).toEqual(['CREATURE_MOVED', 'BATTLE_REJECTED']);
    expect(store.projection?.creatures.find((c) => c.id === 'hero')?.pos).toEqual({ q: 1, r: 0 });
  });

  it('runs the enemy turn and hides where the enemy struck from in the queue', () => {
    const store = startedOn(['s1', 'hero'], [hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })]);
    store.runEnemyTurn(5);
    const events = store.takeEvents();
    const dealt = events.find((e) => e.type === 'STRIKE_DEALT');
    expect(dealt).toBeDefined();
    expect((dealt!.payload as { fromHex: unknown }).fromHex).toBeNull();
    expect(store.projection?.activeId).toBe('hero');
    expect(store.projection?.phase).toBe('defend');
    expect(store.turnStartWill).toBe(20);
    expect(store.needsEnemyTurn).toBe(false);
  });

  it('lets the hero answer a task that opened on the enemy turn', () => {
    const board = hexagonBoard(3, { '-1,0': 'saw' });
    const king = skeleton('k', { q: 1, r: 0 }, { kind: 'skeleton-king', force: 2, weight: 3 });
    const store = startedOn(['k', 'hero'], [hero({ q: 0, r: 0 }), king], board);
    store.runEnemyTurn(0);
    expect(store.projection?.task?.creatureId).toBe('hero');
    expect(store.needsEnemyTurn).toBe(false);

    expect(store.act({ kind: 'answer-task', option: rightAnswer(store.battle!) }, 100)).toBe(true);
    expect(store.projection?.task).toBeUndefined();
    expect(store.needsEnemyTurn).toBe(store.projection?.activeId === 'k');
  });
});
