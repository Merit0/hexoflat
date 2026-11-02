import type { BattleRules } from '../battle-content';
import type { BattleAction } from '../battle-commands';
import type { BattleCreature, BattleHex } from '../battle-state';
import { battleDistance, isAdjacentHex } from '../hex-battle-geom';
import type { BattleProjection } from '../projection';
import { isCornered } from '../strike';
import {
  activeSelf,
  adjacentFoes,
  approachStep,
  defendAction,
  hideStep,
  opponents,
  readyHand,
  retreatStep,
  weakestFirst,
} from './ai-common';

function inRange(self: BattleCreature, from: BattleHex, foe: BattleCreature): boolean {
  const range = self.hands.right?.range ?? self.hands.left?.range;
  if (!range) return false;
  const distance = battleDistance(from, foe.pos);
  return distance >= range.min && distance <= range.max;
}

function cornered(view: BattleProjection, self: BattleCreature, rules: BattleRules): BattleAction {
  const hand = readyHand(view, self);
  const target = adjacentFoes(view, self)[0];
  if (isCornered(view, self) && hand && target && view.turnWill >= rules.strike) {
    return { kind: 'strike', targetId: target.id, hand };
  }
  return { kind: 'end-turn' };
}

export function archerEnemyAction(view: BattleProjection, rules: BattleRules): BattleAction {
  const self = activeSelf(view);
  if (view.phase === 'defend') return defendAction(view, self, rules);
  if (view.struckHands.length > 0) return hideStep(view, self, rules) ?? { kind: 'end-turn' };

  const foes = opponents(view, self);
  const clear = (hex: BattleHex) => !foes.some((foe) => isAdjacentHex(foe.pos, hex));
  if (adjacentFoes(view, self).length > 0) {
    return retreatStep(view, self, rules, clear) ?? cornered(view, self, rules);
  }
  const hand = readyHand(view, self);
  const target = weakestFirst(foes).find((foe) => inRange(self, self.pos, foe));
  if (hand && target && view.turnWill >= rules.strike) {
    return { kind: 'strike', targetId: target.id, hand };
  }
  const firingSpot = (hex: BattleHex) => clear(hex) && foes.some((foe) => inRange(self, hex, foe));
  return approachStep(view, self, rules, firingSpot) ?? { kind: 'end-turn' };
}
