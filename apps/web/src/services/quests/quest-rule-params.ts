import { CONTENT } from '@hexoflat/engine';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { QuestDefinition } from '@hexoflat/engine/quests/quest-definition';

export interface QuestRuleParams {
  will: number;
  entry: number;
  steps: number;
  step: number;
  back: number;
}

function gatherWill(action: unknown): number {
  if (action === 'CUT') {
    return CONTENT[HEXOBJECT_KEYS.TREE].actions?.[EHexActionType.CUT]?.willCost ?? 0;
  }
  if (action === 'MINE') {
    return CONTENT[HEXOBJECT_KEYS.ROCK].actions?.[EHexActionType.MINE]?.willCost ?? 0;
  }
  return 0;
}

export function questRuleParams(quest: QuestDefinition): QuestRuleParams {
  const objective = quest.objective;
  const entry = quest.accept.kind === 'will' ? quest.accept.amount : 0;
  if (objective.kind === 'expedition') {
    const { steps, stepCost, backMultiplier } = objective.params;
    return { will: 0, entry, steps, step: stepCost, back: stepCost * backMultiplier };
  }
  return { will: gatherWill(objective.where?.action), entry, steps: 0, step: 0, back: 0 };
}
