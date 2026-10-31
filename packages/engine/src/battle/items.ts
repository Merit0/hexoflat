import type { DomainEvent } from '../commands/types';
import type { BattleRules } from './battle-content';
import type { BattleCreature, BattleHand, BattleState } from './battle-state';
import { BATTLE_ITEMS, battleItem } from './battle-catalogue';
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

export function setHands(
  state: BattleState,
  actor: BattleCreature,
  wanted: Record<BattleHand, string | null>,
  rules: BattleRules,
): DomainEvent[] | BattleRejection {
  const hands = Object.keys(wanted) as BattleHand[];
  if (hands.some((hand) => wanted[hand] !== null && !BATTLE_ITEMS[wanted[hand]])) {
    return reject('NO_SUCH_ITEM');
  }
  const changed = hands.filter((hand) => (actor.hands[hand]?.key ?? null) !== wanted[hand]);
  if (changed.length === 0) return [];
  const cost = rules.swap * changed.length;
  const refused = spendTurnWill(state, cost);
  if (refused) return { ...refused, cost, left: state.turnWill };

  for (const hand of changed) {
    const outgoing = actor.hands[hand];
    const incoming = wanted[hand];
    if (outgoing) actor.bag.push(outgoing);
    if (incoming) {
      const inBag = actor.bag.findIndex((item) => item.key === incoming);
      if (inBag >= 0) actor.bag.splice(inBag, 1);
    }
    actor.hands[hand] = incoming ? battleItem(incoming) : null;
  }
  state.undo = [];
  return [
    {
      type: 'HANDS_SET',
      payload: {
        creatureId: actor.id,
        right: actor.hands.right?.key ?? null,
        left: actor.hands.left?.key ?? null,
        cost,
        willLeft: state.turnWill,
      },
    },
  ];
}
