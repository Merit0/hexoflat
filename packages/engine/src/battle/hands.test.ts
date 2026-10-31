import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { battleItem } from './battle-catalogue';
import {
  battleWith,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  rejectionOf,
  skeleton,
} from './battle-test-setup';

function scene(heroOverrides = {}) {
  return giveTurn(
    battleWith([hero({ q: 0, r: 0 }, heroOverrides), skeleton('s1', { q: 3, r: 0 })]),
    ['hero', 's1'],
  );
}

describe('REQ-BTL-019 set-hands (the inventory changes the hands during the battle)', () => {
  it('puts a shield in an empty hand for one swap price and takes it out of the bag', () => {
    const battle = scene({
      hands: { right: battleItem('sword'), left: null },
      bag: [battleItem('wooden-shield'), battleItem('health-potion')],
    });
    const { battle: after, events } = heroDoes(battle, {
      kind: 'set-hands',
      right: 'sword',
      left: 'wooden-shield',
    });
    expect(eventTypes(events)).toEqual(['HANDS_SET']);
    expect(after.creatures[0].hands.left?.key).toBe('wooden-shield');
    expect(after.creatures[0].bag.map((i) => i.key)).toEqual(['health-potion']);
    expect(after.turnWill).toBe(20 - BATTLE_RULES.swap);
  });

  it('moves a sword to the other hand, stows the shield, and charges one swap per changed hand', () => {
    const battle = scene();
    const { battle: after } = heroDoes(battle, { kind: 'set-hands', right: null, left: 'sword' });
    expect(after.creatures[0].hands.right).toBeNull();
    expect(after.creatures[0].hands.left?.key).toBe('sword');
    expect(after.creatures[0].bag.map((i) => i.key)).toEqual(['wooden-shield']);
    expect(after.turnWill).toBe(20 - 2 * BATTLE_RULES.swap);
  });

  it('is free and silent when nothing changes, and refuses unknown items and a short purse', () => {
    const battle = scene();
    const same = heroDoes(battle, { kind: 'set-hands', right: 'sword', left: 'wooden-shield' });
    expect(same.events).toEqual([]);
    expect(same.battle.turnWill).toBe(20);

    expect(
      rejectionOf(heroDoes(battle, { kind: 'set-hands', right: 'nonsense', left: null }).events),
    ).toBe('NO_SUCH_ITEM');

    battle.turnWill = 3;
    const poor = heroDoes(battle, { kind: 'set-hands', right: null, left: 'wooden-shield' });
    expect(rejectionOf(poor.events)).toBe('INSUFFICIENT_WILL');
    expect(poor.battle).toBe(battle);
  });

  it('works only in the act phase of the hero turn', () => {
    const battle = scene();
    battle.pending = [
      { id: 'p', attackerId: 's1', targetId: 'hero', fromHex: { q: 1, r: 0 }, ring: [], power: 1 },
    ];
    battle.phase = 'defend';
    expect(
      rejectionOf(heroDoes(battle, { kind: 'set-hands', right: null, left: null }).events),
    ).toBe('WRONG_PHASE');
  });
});
