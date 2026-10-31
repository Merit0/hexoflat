import type { BattleRules } from '../battle-content';
import type { BattleAction } from '../battle-commands';
import type { BattleCreature, BattleHex } from '../battle-state';
import { isFreeHex, terrainAt } from '../battle-board';
import { directionIndex, hexInDirection, isAdjacentHex } from '../hex-battle-geom';
import type { BattleProjection } from '../projection';
import {
  activeSelf,
  adjacentFoes,
  approachStep,
  defendAction,
  isCrowdedAround,
  opponents,
  reachableFoes,
  readyHand,
} from './ai-common';

function pushToSaw(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleAction | null {
  if (view.turnWill < rules.push + rules.strike) return null;
  const victim = adjacentFoes(view, self).find((foe) => {
    const behind = hexInDirection(foe.pos, directionIndex(self.pos, foe.pos));
    return self.force >= foe.weight && terrainAt(view, behind) === 'saw' && isFreeHex(view, behind);
  });
  return victim ? { kind: 'push', targetId: victim.id } : null;
}

export function meleeAction(
  view: BattleProjection,
  rules: BattleRules,
  pushesToSaw: boolean,
): BattleAction {
  const self = activeSelf(view);
  if (view.phase === 'defend') return defendAction(view, self, rules);
  if (view.struckHands.length > 0) return { kind: 'end-turn' };

  const push = pushesToSaw ? pushToSaw(view, self, rules) : null;
  if (push) return push;
  const hand = readyHand(view, self);
  const target = reachableFoes(view, self, rules)[0];
  if (target && hand) {
    return view.turnWill >= rules.strike
      ? { kind: 'strike', targetId: target.id, hand }
      : { kind: 'end-turn' };
  }
  const nextToFoe = (hex: BattleHex) =>
    opponents(view, self).some(
      (foe) => isAdjacentHex(foe.pos, hex) && !isCrowdedAround(view, self, foe),
    );
  return approachStep(view, self, rules, nextToFoe) ?? { kind: 'end-turn' };
}
