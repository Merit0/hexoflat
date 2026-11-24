import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import { QUEST_BOARD_RULES, type QuestBoardRules } from '../content/quest-board.content';
import { gameDayAt } from '../game-day/game-day';
import { spendWill } from '../knowledge/will';
import { describeQuest } from './objectives';
import { questBoardForDay } from './quest-board-state';
import type { QuestBoardCommand } from './quest-commands';
import type { QuestBoardRefusal, QuestRefusal } from './quest-definition';
import { generateQuestOffers, type QuestGenerationInput } from './quest-generator';
import type { QuestOffer } from './quest-offer';

export type QuestBoardContext = Pick<QuestGenerationInput, 'rngSeed' | 'locationDropContexts'> & {
  rules?: QuestBoardRules;
};

export function questBoardRefreshCost(refreshes: number, rules = QUEST_BOARD_RULES): number {
  return rules.refreshBase + refreshes * rules.refreshIncrement;
}

function issue(
  progress: ProgressState,
  ctx: QuestBoardContext,
  recentOffers?: QuestOffer[],
): { progress: ProgressState; events: DomainEvent[] } {
  const board = progress.quests.board!;
  const rules = ctx.rules ?? QUEST_BOARD_RULES;
  const offers = generateQuestOffers({
    ...ctx,
    heroId: progress.knowledge.heroId,
    dayId: board.dayId,
    issuedToday: board.issued,
    count: (rules.dailyLimit ?? Infinity) - board.issued,
    log: progress.quests,
    recentOffers,
  });
  if (offers.length === 0) return { progress, events: [] };
  return {
    progress: {
      ...progress,
      quests: {
        ...progress.quests,
        board: { ...board, issued: board.issued + offers.length },
        offers: [...(progress.quests.offers ?? []), ...offers],
      },
    },
    events: [
      {
        type: 'QUEST_OFFERS_ISSUED',
        payload: {
          heroId: progress.knowledge.heroId,
          dayId: board.dayId,
          offerIds: offers.map(({ id }) => id),
        },
      },
    ],
  };
}

export function refillQuestBoard<T extends { progress: ProgressState; events: DomainEvent[] }>(
  before: ProgressState,
  outcome: T,
  now: number,
  ctx: QuestBoardContext,
): T {
  const { progress } = outcome;
  const played = gameDayAt(before.day, now).day;
  if (
    !progress.quests.board ||
    !progress.day ||
    progress.day.questsCompleted <= played.questsCompleted ||
    gameDayAt(progress.day, now).reason
  )
    return outcome;
  const filled = issue(progress, ctx, before.quests.offers);
  if (!filled.events.length) return outcome;
  return { ...outcome, progress: filled.progress, events: [...outcome.events, ...filled.events] };
}

function offerSignature({ definition: quest }: QuestOffer): string {
  const rewards = quest.rewards.map((reward) => {
    if (reward.kind === 'will') return [reward.kind, reward.amount];
    return [reward.itemKey, reward.amount, reward.token?.baseKey, reward.token?.attributes];
  });
  return JSON.stringify([quest.id, describeQuest(quest).target, quest.locations, rewards]);
}

type BoardPlan =
  { progress: ProgressState; events: DomainEvent[] } | QuestRefusal | QuestBoardRefusal;

function refresh(
  progress: ProgressState,
  command: Extract<QuestBoardCommand, { type: 'QUEST_BOARD_REFRESH' }>,
  dayId: number,
  ctx: QuestBoardContext,
): BoardPlan {
  const { board, active, offers = [] } = progress.quests;
  const { dayId: expectedDay, expectedPrice } = command.payload;
  if (!board || board.dayId !== dayId || expectedDay !== dayId) return 'QUEST_BOARD_STALE';
  const rules = ctx.rules ?? QUEST_BOARD_RULES;
  const cost = questBoardRefreshCost(board.refreshes, rules);
  if (cost !== expectedPrice) return 'QUEST_BOARD_STALE';
  if (progress.knowledge.current < cost) return 'INSUFFICIENT_WILL';
  const taken = new Set(active.map(({ questId }) => questId));
  const kept = offers.filter(({ id }) => taken.has(id));
  const replaced = offers.filter(({ id }) => !taken.has(id));
  if (
    rules.dailyLimit !== undefined &&
    rules.dailyLimit - board.issued < Math.max(1, replaced.length)
  )
    return 'QUEST_BOARD_LIMIT';
  const result = issue(
    { ...progress, quests: { ...progress.quests, offers: kept } },
    ctx,
    replaced,
  );
  const added = result.progress.quests.offers!.slice(kept.length);
  if (added.length === 0 || added.length < replaced.length) return 'QUEST_BOARD_UNCHANGED';
  const previous = new Set(replaced.map(offerSignature));
  if (
    added.length === replaced.length &&
    added.every((offer) => previous.has(offerSignature(offer)))
  )
    return 'QUEST_BOARD_UNCHANGED';

  const knowledge = { ...progress.knowledge };
  const spent = spendWill(knowledge, cost, 'quest', 'quest-board:refresh');
  knowledge.revision++;
  result.progress.knowledge = knowledge;
  result.progress.quests.board!.refreshes++;
  result.events.unshift(...spent.events);
  result.events.push({
    type: 'QUEST_BOARD_REFRESHED',
    payload: { heroId: knowledge.heroId, dayId, cost },
  });
  return result;
}

export function planQuestBoard(
  progress: ProgressState,
  command: QuestBoardCommand,
  dayId: number,
  ctx: QuestBoardContext,
): BoardPlan {
  if (command.type === 'QUEST_BOARD_REFRESH') return refresh(progress, command, dayId, ctx);
  const prepared = questBoardForDay(progress, dayId);
  const filled = issue(prepared, ctx);
  if (prepared !== progress)
    filled.events.unshift({
      type: 'QUEST_BOARD_SYNCED',
      payload: { heroId: progress.knowledge.heroId, dayId },
    });
  return filled;
}
