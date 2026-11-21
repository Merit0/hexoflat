import type { DomainEvent } from '../commands/types';
import { resolveItemStats } from '../tokens/equipment/item-stats';
import { itemShieldBase } from './shield-stats';
import type { BattleCreature } from './battle-state';
import type { StrikeResolution } from './strike-pipeline';

/** Only the held shields that blocked the actual strike can restore hearts. */
export function healBlockedStrike(
  defender: BattleCreature,
  result: StrikeResolution,
): DomainEvent[] {
  if (
    defender.side !== 'heroes' ||
    defender.hp <= 0 ||
    !result.blocked ||
    result.damageBeforeBlock <= 0
  )
    return [];
  const bonus = [defender.hands.right, defender.hands.left].reduce((sum, item) => {
    if (!item || itemShieldBase(item).sides === 0 || item.token?.type !== 'shield') return sum;
    return sum + resolveItemStats({ key: item.token.type, token: item.token }).healOnBlock;
  }, 0);
  const healed = Math.min(4, bonus, Math.max(0, defender.maxHp - defender.hp));
  if (healed <= 0) return [];
  defender.hp += healed;
  return [
    {
      type: 'CREATURE_HEALED',
      payload: { creatureId: defender.id, healed, hp: defender.hp, source: 'heal-on-block' },
    },
  ];
}
