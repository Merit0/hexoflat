import { ALL_QUESTS } from '@hexoflat/engine/quests/all-quests';
import { describeQuest } from '@hexoflat/engine/quests/objectives';
import type { QuestOfferProjection } from '@hexoflat/engine/quests/quest-board-projection';
import { questRuleParams } from './quest-rule-params';

export type QuestCardContent = Omit<QuestOfferProjection, 'dayId' | 'turnIn'>;

export function legacyQuestCard(id: string): QuestCardContent | undefined {
  const definition = ALL_QUESTS[id];
  if (!definition) return;
  const { nameKey, descKey, tableRule, locations, accept, rewards, repeat, objective } = definition;
  return {
    id,
    templateId: id,
    nameKey,
    descKey,
    tableRule,
    howKey: `quest.${id}.how`,
    locations,
    accept,
    rewards,
    repeat,
    goal: describeQuest(definition),
    ...(objective.kind === 'expedition' ? { expedition: objective.params } : {}),
  };
}

export function questCardRuleParams(quest: QuestCardContent) {
  const template = ALL_QUESTS[quest.templateId];
  const expedition = quest.expedition;
  return {
    target: quest.goal.target,
    will: template ? questRuleParams(template).will : 0,
    entry: quest.accept.kind === 'will' ? quest.accept.amount : 0,
    steps: expedition?.steps ?? 0,
    step: expedition?.stepCost ?? 0,
    back: expedition ? expedition.stepCost * expedition.backMultiplier : 0,
  };
}
