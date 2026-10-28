import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleHand, BattleState } from './battle-state';
import { reject, spendTurnWill, type BattleRejection } from './battle-rejection';

export function swapItem(
  state: BattleState,
  actor: BattleCreature,
  hand: BattleHand,
  bagIndex: number,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const incoming = actor.bag[bagIndex];
  if (!incoming) return reject('NO_SUCH_ITEM');
  const refused = spendTurnWill(state, rules.swap);
  if (refused) return refused;

  const outgoing = actor.hands[hand];
  actor.bag.splice(bagIndex, 1);
  if (outgoing) actor.bag.push(outgoing);
  actor.hands[hand] = incoming;
  state.undo = [];
  return [
    {
      type: 'ITEM_SWAPPED',
      payload: {
        creatureId: actor.id,
        hand,
        taken: incoming.key,
        stowed: outgoing?.key ?? null,
        cost: rules.swap,
        willLeft: state.turnWill,
      },
    },
  ];
}

export function useItem(
  state: BattleState,
  actor: BattleCreature,
  hand: BattleHand,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const item = actor.hands[hand];
  if (!item) return reject('NO_SUCH_ITEM');
  if (!item.heal) return reject('NOT_USABLE');
  const refused = spendTurnWill(state, rules.use);
  if (refused) return refused;

  const before = actor.hp;
  actor.hp = Math.min(actor.maxHp, actor.hp + item.heal);
  actor.hands[hand] = null;
  state.undo = [];
  return [
    {
      type: 'ITEM_USED',
      payload: {
        creatureId: actor.id,
        hand,
        itemKey: item.key,
        healed: actor.hp - before,
        hp: actor.hp,
        cost: rules.use,
        willLeft: state.turnWill,
      },
    },
  ];
}
