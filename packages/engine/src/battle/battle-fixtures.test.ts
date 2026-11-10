import { describe, expect, it } from 'vitest';
import { giveTurn, hero, skeleton, hexagonBoard } from './battle-test-setup';
import { startBattle } from './start-battle';
import { applyBattleFixture, battleFixtureSchema } from './battle-fixtures';

function fresh() {
  return startBattle({
    id: 'b',
    seed: 's',
    board: hexagonBoard(3),
    creatures: [
      hero({ q: 0, r: 0 }),
      skeleton('s1', { q: 3, r: 0 }),
      skeleton('s2', { q: -3, r: 0 }),
    ],
    boulders: [],
  }).battle;
}

describe('battle fixtures (e2e only)', () => {
  it('rejects unknown fields and out-of-range values (REQ-FIX-001)', () => {
    expect(battleFixtureSchema.safeParse({ kind: 'hero-turn', will: 99 }).success).toBe(false);
    expect(battleFixtureSchema.safeParse({ kind: 'hero-turn', will: 5, extra: 1 }).success).toBe(
      false,
    );
    expect(battleFixtureSchema.safeParse({ kind: 'finish', outcome: 'draw' }).success).toBe(false);
  });

  it('gives the hero the turn with the asked Will and no leftovers (REQ-FIX-002)', () => {
    const next = applyBattleFixture(giveTurn(fresh(), ['s1', 'hero']), {
      kind: 'hero-turn',
      will: 7,
    });
    expect(next.activeId).toBe('hero');
    expect(next.turnWill).toBe(7);
    expect(next.phase).toBe('act');
    expect(next.reaction).toBeUndefined();
  });

  it('gives an enemy the turn two hexes from the hero (REQ-FIX-003)', () => {
    const next = applyBattleFixture(fresh(), { kind: 'enemy-turn', will: 20 });
    const active = next.creatures.find((c) => c.id === next.activeId)!;
    expect(active.side).toBe('enemies');
  });

  it('crowds enemies beside the hero (REQ-FIX-004)', () => {
    const next = applyBattleFixture(fresh(), { kind: 'crowd', adjacent: 2, far: 0 });
    const heroPos = next.creatures.find((c) => c.side === 'heroes')!.pos;
    const near = next.creatures.filter(
      (c) =>
        c.side === 'enemies' &&
        Math.max(Math.abs(c.pos.q - heroPos.q), Math.abs(c.pos.r - heroPos.r)) <= 1,
    );
    expect(near.length).toBeGreaterThanOrEqual(2);
  });

  it('ends the battle for the chosen outcome and keeps the source untouched (REQ-FIX-005)', () => {
    const source = fresh();
    const next = applyBattleFixture(source, { kind: 'finish', outcome: 'defeat' });
    expect(next.outcome).toBe('defeat');
    expect(next.phase).toBe('ended');
    expect(source.phase).not.toBe('ended');
  });

  it('refuses to hold a window that is not open (REQ-FIX-006)', () => {
    expect(() => applyBattleFixture(fresh(), { kind: 'hold-window', extraMs: 1000 })).toThrow();
  });
});
