import { describe, expect, it } from 'vitest';
import { battleItem } from './battle-catalogue';
import {
  battleWith,
  enemyDoes,
  giveTurn,
  hero,
  hexagonBoard,
  skeleton,
  strikeOpened,
} from './battle-test-setup';

describe('EA5 strike characterization', () => {
  it.each([
    { blocked: false, ledge: false, damage: 2 },
    { blocked: true, ledge: false, damage: 0 },
    { blocked: false, ledge: true, damage: 3 },
    { blocked: true, ledge: true, damage: 0 },
  ])(
    'keeps direct damage and melee sweep for $blocked block, $ledge ledge',
    ({ blocked, ledge, damage }) => {
      const before = giveTurn(
        battleWith(
          [
            hero({ q: 0, r: 0 }),
            skeleton(
              'target',
              { q: 1, r: 0 },
              { hp: 8, maxHp: 8, hands: { right: null, left: battleItem('bone-buckler') } },
            ),
            skeleton('bystander', { q: 0, r: 1 }, { hp: 8, maxHp: 8 }),
          ],
          hexagonBoard(3, ledge ? { '0,0': 'ledge' } : {}),
        ),
        ['hero', 'target', 'bystander'],
      );
      let pending = strikeOpened(before, 'hero', 'target');
      if (blocked)
        pending = enemyDoes(
          pending,
          { kind: 'place-shield', hex: { q: 0, r: 0 } },
          'target',
        ).battle;
      const { battle, events } = enemyDoes(pending, { kind: 'reaction-timeout' }, 'target');
      expect(battle.creatures.map((creature) => creature.hp)).toEqual([
        6,
        8 - damage,
        ledge ? 5 : 6,
      ]);
      expect(battle.turnWill).toBe(13);
      expect(battle.struckHands).toEqual(['right']);
      expect(battle.pending).toEqual([]);
      expect(battle.reaction).toBeUndefined();
      expect(events.find((event) => event.type === 'STRIKES_RESOLVED')?.payload).toMatchObject({
        results: [{ damage, outcome: blocked ? 'blocked' : 'hit' }],
      });
      expect(events.find((event) => event.type === 'STRIKE_SWEPT')?.payload).toMatchObject({
        damage: ledge ? 3 : 2,
      });
      expect(before.creatures.map((creature) => creature.hp)).toEqual([6, 8, 8]);
    },
  );
});
