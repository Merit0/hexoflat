import { describe, expect, it } from 'vitest';
import { battleItem } from './battle-catalogue';
import {
  battleWith,
  enemyDoes,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  skeleton,
  strikeOpened,
} from './battle-test-setup';

const FIELD = { hp: 6, maxHp: 6 };

function crowded() {
  return giveTurn(
    battleWith([
      hero({ q: 0, r: 0 }, { hp: 12, maxHp: 12 }),
      skeleton('s1', { q: 1, r: 0 }, FIELD),
      skeleton('s2', { q: 0, r: 1 }, FIELD),
    ]),
    ['hero', 's1', 's2'],
  );
}

describe('melee sweep (the weapon on its way hits everyone it passes)', () => {
  it('hurts every other enemy beside the hero for the weapon power, not only the target', () => {
    const { battle, events } = heroDoes(crowded(), {
      kind: 'strike',
      targetId: 's1',
      hand: 'right',
    });
    expect(battle.creatures.find((c) => c.id === 's1')!.hp).toBe(4);
    expect(battle.creatures.find((c) => c.id === 's2')!.hp).toBe(4);
    expect(eventTypes(events)).toContain('STRIKE_SWEPT');
    expect(battle.creatures.find((c) => c.id === 'hero')!.hp).toBe(12);
  });

  it('hurts the bystander even when the chosen target blocks the strike', () => {
    const start = giveTurn(
      battleWith([
        hero({ q: 0, r: 0 }, { hp: 12, maxHp: 12 }),
        skeleton(
          's1',
          { q: 1, r: 0 },
          { ...FIELD, hands: { right: null, left: battleItem('bone-buckler') } },
        ),
        skeleton('s2', { q: 0, r: 1 }, FIELD),
      ]),
      ['hero', 's1', 's2'],
    );
    let battle = strikeOpened(start, 'hero', 's1');
    battle = enemyDoes(battle, { kind: 'place-shield', hex: { q: 0, r: 0 } }, 's1').battle;
    const { battle: after, events } = enemyDoes(battle, { kind: 'reaction-timeout' }, 's1');
    expect(after.reaction).toBeUndefined();
    expect(after.creatures.find((c) => c.id === 's1')!.hp).toBe(6);
    expect(after.creatures.find((c) => c.id === 's2')!.hp).toBe(4);
    expect(eventTypes(events)).toContain('STRIKE_SWEPT');
  });

  it('never hurts the allies of the one who swings, nor the swinger', () => {
    const battle = giveTurn(
      battleWith([
        hero({ q: 0, r: 0 }, { hp: 12, maxHp: 12 }),
        hero({ q: -1, r: 0 }, { id: 'friend', hp: 12, maxHp: 12 }),
        skeleton('s1', { q: 1, r: 0 }, FIELD),
      ]),
      ['hero', 'friend', 's1'],
    );
    const after = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' }).battle;
    expect(after.creatures.find((c) => c.id === 'friend')!.hp).toBe(12);
    expect(after.creatures.find((c) => c.id === 'hero')!.hp).toBe(12);
  });

  it('lets an enemy swing hurt every hero standing beside it', () => {
    const battle = giveTurn(
      battleWith([
        hero({ q: 0, r: 0 }, { hp: 12, maxHp: 12 }),
        hero({ q: 2, r: -1 }, { id: 'friend', hp: 12, maxHp: 12 }),
        skeleton('s1', { q: 1, r: 0 }, FIELD),
      ]),
      ['s1', 'hero', 'friend'],
    );
    let opened = strikeOpened(battle, 's1', 'hero');
    opened = heroDoes(opened, { kind: 'take-hit' }).battle;
    expect(opened.creatures.find((c) => c.id === 'hero')!.hp).toBe(10);
    expect(opened.creatures.find((c) => c.id === 'friend')!.hp).toBe(10);
    expect(opened.wounds.friend).toHaveLength(1);
  });

  it('does not sweep with a ranged weapon', () => {
    const battle = giveTurn(
      battleWith([
        hero(
          { q: 0, r: 0 },
          { hp: 12, maxHp: 12, hands: { right: battleItem('bone-bow'), left: null } },
        ),
        skeleton('s1', { q: 2, r: 0 }, FIELD),
        skeleton('s2', { q: 0, r: 1 }, FIELD),
      ]),
      ['hero', 's1', 's2'],
    );
    const { battle: after, events } = heroDoes(battle, {
      kind: 'strike',
      targetId: 's1',
      hand: 'right',
    });
    expect(eventTypes(events)).not.toContain('STRIKE_SWEPT');
    expect(after.creatures.find((c) => c.id === 's2')!.hp).toBe(6);
  });

  it('sweeps with an empty hand too, for the fist damage, never past two hexes', () => {
    const battle = giveTurn(
      battleWith([
        hero({ q: 0, r: 0 }, { hp: 12, maxHp: 12, hands: { right: null, left: null } }),
        skeleton('s1', { q: 1, r: 0 }, FIELD),
        skeleton('s2', { q: 0, r: 1 }, FIELD),
        skeleton('s3', { q: -2, r: 0 }, FIELD),
      ]),
      ['hero', 's1', 's2', 's3'],
    );
    const { battle: after } = heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' });
    expect(after.creatures.find((c) => c.id === 's2')!.hp).toBe(5);
    expect(after.creatures.find((c) => c.id === 's3')!.hp).toBe(6);
  });
});
