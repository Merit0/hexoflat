import { QUEST_BOARD_RULES } from '../content/quest-board.content';
import { describeQuest } from './objectives';
import { questBoardRefreshCost } from './quest-board';
import type { QuestLog } from './quest-log-state';
import type { QuestOffer } from './quest-offer';

export function projectQuestOffer(offer: QuestOffer) {
  const { definition, howKey, templateId, id, dayId } = offer;
  const { nameKey, descKey, tableRule, locations, accept, rewards, repeat, turnIn } = definition;
  const objective = definition.objective;
  return {
    id,
    templateId,
    dayId,
    nameKey,
    descKey,
    tableRule,
    howKey,
    locations,
    accept,
    rewards,
    repeat,
    turnIn,
    goal: describeQuest(definition),
    ...(objective.kind === 'expedition'
      ? {
          expedition: {
            steps: objective.params.steps,
            stepCost: objective.params.stepCost,
            backMultiplier: objective.params.backMultiplier,
          },
        }
      : {}),
  };
}

export type QuestOfferProjection = ReturnType<typeof projectQuestOffer>;

export function projectQuestBoard(log: QuestLog) {
  if (!log.board) return null;
  return {
    dayId: log.board.dayId,
    refreshPrice: questBoardRefreshCost(log.board.refreshes),
    remaining:
      QUEST_BOARD_RULES.dailyLimit === undefined
        ? null
        : Math.max(0, QUEST_BOARD_RULES.dailyLimit - log.board.issued),
    offers: (log.offers ?? []).map(projectQuestOffer),
  };
}

export type QuestOfferBoardProjection = NonNullable<ReturnType<typeof projectQuestBoard>>;
