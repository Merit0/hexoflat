import type { DomainEvent } from '../commands/types';
import type { InventoryState } from '../inventory/inventory-state';
import { planAbandon, planAccept, planClaim, type QuestPlan } from '../quests/quest-log';
import type { QuestBoardCommand, QuestCommand } from '../quests/quest-commands';
import { planQuestBoard, type QuestBoardContext } from '../quests/quest-board';
import { ALL_QUESTS } from '../quests/all-quests';
import type { ProgressState } from './progress-state';

export interface QuestApplyContext {
  atBoard: boolean;
  rngSeed?: string;
  dayId?: number;
  board?: QuestBoardContext;
}

export interface QuestApplyResult {
  changed: { inventory?: InventoryState; progress?: ProgressState };
  events: DomainEvent[];
}

type Command = QuestCommand | QuestBoardCommand;

function rejected(command: Command, reason: string): QuestApplyResult {
  const { heroId } = command.payload;
  const questId = 'questId' in command.payload ? command.payload.questId : undefined;
  return {
    changed: {},
    events: [{ type: 'QUEST_REJECTED', payload: { heroId, questId, reason } }],
  };
}

function plan(
  aggregates: { inventory: InventoryState; progress: ProgressState },
  command: QuestCommand,
  ctx: QuestApplyContext,
): QuestPlan {
  const { progress, inventory } = aggregates;
  const questId = command.payload.questId;
  const context = {
    catalogue: ALL_QUESTS,
    atBoard: ctx.atBoard,
    rngSeed: ctx.rngSeed,
    dayId: ctx.dayId,
  };
  if (command.type === 'QUEST_ACCEPT') return planAccept(progress, inventory, questId, context);
  if (command.type === 'QUEST_CLAIM') return planClaim(progress, inventory, questId, context);
  return planAbandon(progress, inventory, questId);
}

export function applyQuestCommand(
  aggregates: { inventory: InventoryState; progress: ProgressState },
  command: Command,
  ctx: QuestApplyContext,
): QuestApplyResult {
  const { heroId, revision } = command.payload;
  if (heroId !== aggregates.inventory.heroId) return rejected(command, 'WRONG_HERO');
  if (command.type === 'QUEST_BOARD_SYNC' || command.type === 'QUEST_BOARD_REFRESH') {
    if (!ctx.atBoard) return rejected(command, 'NOT_AT_BOARD');
    if (!ctx.board || !ctx.dayId) return rejected(command, 'QUEST_BOARD_STALE');
    const planned = planQuestBoard(aggregates.progress, command, ctx.dayId, ctx.board);
    if (typeof planned === 'string') return rejected(command, planned);
    return {
      changed: planned.progress === aggregates.progress ? {} : { progress: planned.progress },
      events: planned.events,
    };
  }
  if (revision !== aggregates.inventory.revision) return rejected(command, 'INVENTORY_STALE');
  const result = plan(aggregates, command, ctx);
  if (!result.ok) return { changed: {}, events: result.events };
  const changed: QuestApplyResult['changed'] = { progress: result.progress };
  if (result.inventory && result.inventory !== aggregates.inventory) {
    changed.inventory = result.inventory;
  }
  return { changed, events: result.events };
}
