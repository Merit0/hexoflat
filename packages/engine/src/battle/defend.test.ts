import { describe, expect, it } from 'vitest';
import type { BattleState } from './battle-state';
import {
  battleWith,
  enemyDoes,
  enemyTurn,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  rejectionOf,
  skeleton,
} from './battle-test-setup';

const EAST = { q: 1, r: 0 };
const SOUTH = { q: 0, r: 1 };
const WEST = { q: -1, r: 0 };

function heroUnderAttack(heroOverrides = {}): BattleState {
  const start = giveTurn(
    battleWith([hero({ q: 0, r: 0 }, heroOverrides), skeleton('s1', { q: 1, r: 0 })]),
    ['s1', 'hero'],
  );
  return enemyTurn(start).battle;
}

function aimAt(battle: BattleState, hex: { q: number; r: number }) {
  return enemyDoes(battle, { kind: 'aim', hex });
}

describe('REQ-BTL-006 block window', () => {
  it('opens the moment the enemy picks the hero, and the hero acts out of turn', () => {
    const battle = heroUnderAttack();
    expect(battle.phase).toBe('defend');
    expect(battle.activeId).toBe('hero');
    expect(battle.reaction).toMatchObject({ stage: 'block', attackerId: 's1' });
    expect(battle.reaction!.deadlineMs - 0).toBeGreaterThan(0);
  });

  it('blocks without spending any Will', () => {
    const battle = heroDoes(heroUnderAttack(), { kind: 'place-shield', hex: EAST }).battle;
    expect(battle.turnWill).toBe(0);
    expect(battle.placedShields).toEqual([EAST]);
  });

  it('lets the enemy choose from where to strike once the shields are down, and blocks the shielded side', () => {
    let battle = heroUnderAttack();
    battle = heroDoes(battle, { kind: 'place-shield', hex: EAST }).battle;
    battle = heroDoes(battle, { kind: 'place-shield', hex: WEST }).battle;
    const done = heroDoes(battle, { kind: 'reaction-timeout' });
    expect(eventTypes(done.events)).toEqual(['REACTION_AIMING']);
    expect(done.battle.activeId).toBe('s1');
    expect(done.battle.reaction!.stage).toBe('aim');

    const { battle: after, events } = aimAt(done.battle, EAST);
    expect(after.creatures[0].hp).toBe(6);
    expect(after.reaction).toBeUndefined();
    expect(after.pending).toEqual([]);
    expect(after.activeId).toBe('s1');
    const resolved = events.find((e) => e.type === 'STRIKES_RESOLVED')!.payload as {
      results: { outcome: string }[];
      burnedShields: unknown[];
    };
    expect(resolved.results.map((r) => r.outcome)).toEqual(['blocked']);
    expect(resolved.burnedShields).toEqual([EAST, WEST]);
  });

  it('lets a strike from an unshielded side through, and the enemy walks there', () => {
    let battle = heroUnderAttack();
    battle = heroDoes(battle, { kind: 'place-shield', hex: EAST }).battle;
    const aiming = heroDoes(battle, { kind: 'reaction-timeout' }).battle;
    const { battle: after, events } = aimAt(aiming, SOUTH);
    expect(after.creatures[0].hp).toBe(5);
    expect(after.creatures[1].pos).toEqual(SOUTH);
    expect(eventTypes(events)).toContain('CREATURE_MOVED');
  });

  it('refuses an aim off the ring and any other action while the enemy aims', () => {
    const aiming = heroDoes(
      heroDoes(heroUnderAttack(), { kind: 'place-shield', hex: EAST }).battle,
      { kind: 'reaction-timeout' },
    ).battle;
    expect(rejectionOf(aimAt(aiming, { q: 5, r: 5 }).events)).toBe('NOT_AN_OPTION');
    expect(rejectionOf(enemyDoes(aiming, { kind: 'end-turn' }).events)).toBe('AIM_PENDING');
  });

  it('hits at once, from where the enemy stands, when the hero takes the hit without a shield', () => {
    const battle = heroUnderAttack();
    const { battle: after, events } = heroDoes(battle, { kind: 'take-hit' });
    expect(after.creatures[0].hp).toBe(5);
    expect(after.activeId).toBe('s1');
    expect(after.phase).toBe('act');
    expect(eventTypes(events)).toContain('STRIKES_RESOLVED');
  });

  it('counts the shields standing when the five seconds run out, and takes the hit if there are none', () => {
    const idle = heroDoes(heroUnderAttack(), { kind: 'reaction-timeout' }, 'hero', 5000).battle;
    expect(idle.creatures[0].hp).toBe(5);

    const shielded = heroDoes(heroUnderAttack(), { kind: 'place-shield', hex: EAST }).battle;
    const aiming = heroDoes(shielded, { kind: 'reaction-timeout' }, 'hero', 5000).battle;
    expect(aiming.reaction!.stage).toBe('aim');
    const late = enemyDoes(aiming, { kind: 'reaction-timeout' }, 's1', 10_000);
    expect(late.battle.creatures[0].hp).toBe(6);
  });

  it('caps shields at the capacity of the shield in hand', () => {
    let battle = heroUnderAttack();
    battle = heroDoes(battle, { kind: 'place-shield', hex: EAST }).battle;
    battle = heroDoes(battle, { kind: 'place-shield', hex: SOUTH }).battle;
    expect(rejectionOf(heroDoes(battle, { kind: 'place-shield', hex: WEST }).events)).toBe(
      'SHIELD_CAPACITY_REACHED',
    );
  });

  it('refuses shields without a shield in hand and off the ring', () => {
    const noShield = heroUnderAttack({ hands: { right: { key: 'sword', power: 2 }, left: null } });
    expect(rejectionOf(heroDoes(noShield, { kind: 'place-shield', hex: EAST }).events)).toBe(
      'NO_SHIELD_IN_HAND',
    );
    const battle = heroUnderAttack();
    expect(
      rejectionOf(heroDoes(battle, { kind: 'place-shield', hex: { q: 2, r: 0 } }).events),
    ).toBe('NOT_IN_RING');
  });

  it('takes a raised shield back at no cost', () => {
    let battle = heroDoes(heroUnderAttack(), { kind: 'place-shield', hex: EAST }).battle;
    battle = heroDoes(battle, { kind: 'remove-shield', hex: EAST }).battle;
    expect(battle.placedShields).toEqual([]);
  });

  it('keeps defend and act apart', () => {
    const battle = heroUnderAttack();
    expect(rejectionOf(heroDoes(battle, { kind: 'move', hex: WEST }).events)).toBe('WRONG_PHASE');
  });

  it('keeps the attacker standing still while the defender decides', () => {
    const battle = heroUnderAttack();
    const attempts = [
      { kind: 'move', hex: { q: 1, r: 1 } },
      { kind: 'strike', targetId: 'hero', hand: 'right' },
      { kind: 'end-turn' },
      { kind: 'undo-step' },
    ] as const;
    for (const action of attempts) {
      const refused = enemyDoes(battle, action);
      expect(rejectionOf(refused.events)).toBe('NOT_YOUR_TURN');
      expect(refused.battle).toBe(battle);
    }
    expect(rejectionOf(enemyTurn(battle).events)).toBe('NOT_YOUR_TURN');
  });
});
