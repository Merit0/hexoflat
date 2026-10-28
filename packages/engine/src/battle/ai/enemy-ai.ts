import type { BattleRules } from '../battle-content';
import type { BattleAction } from '../battle-commands';
import { behaviourOf } from '../battle-catalogue';
import type { BattleProjection } from '../projection';
import { activeSelf } from './ai-common';
import { archerEnemyAction } from './archer-enemy';
import { meleeAction } from './melee-ai';

export function nextEnemyAction(view: BattleProjection, rules: BattleRules): BattleAction {
  switch (behaviourOf(activeSelf(view).kind)) {
    case 'archer':
      return archerEnemyAction(view, rules);
    case 'king':
      return meleeAction(view, rules, true);
    default:
      return meleeAction(view, rules, false);
  }
}
