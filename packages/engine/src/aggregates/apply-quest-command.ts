import type { DomainEvent } from '../commands/types';
import type { InventoryState } from '../inventory/inventory-state';
import { planAbandon, planAccept, planClaim, type QuestPlan } from '../quests/quest-log';
import type { QuestCommand } from '../quests/quest-commands';
import { QUESTS } from '../quests/quests.content';
import type { ProgressState } from './progress-state';

export interface QuestApplyContext {
  atBoard: boolean;
}

export interface QuestApplyResult {
  changed: { inventory?: InventoryState; progress?: ProgressState };
  events: DomainEvent[];
}

function rejected(command: QuestCommand, reason: string): QuestApplyResult {
  const { heroId, questId } = command.payload;
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
  const context = { catalogue: QUESTS, atBoard: ctx.atBoard };
  if (command.type === 'QUEST_ACCEPT') return planAccept(progress, inventory, questId, context);
  if (command.type === 'QUEST_CLAIM') return planClaim(progress, inventory, questId, context);
  return planAbandon(progress, inventory, questId);
}

export function applyQuestCommand(
  aggregates: { inventory: InventoryState; progress: ProgressState },
  command: QuestCommand,
  ctx: QuestApplyContext,
): QuestApplyResult {
  const { heroId, revision } = command.payload;
  if (heroId !== aggregates.inventory.heroId) return rejected(command, 'WRONG_HERO');
  if (revision !== aggregates.inventory.revision) return rejected(command, 'INVENTORY_STALE');
  const result = plan(aggregates, command, ctx);
  if (!result.ok) return { changed: {}, events: result.events };
  const changed: QuestApplyResult['changed'] = { progress: result.progress };
  if (result.inventory && result.inventory !== aggregates.inventory) {
    changed.inventory = result.inventory;
  }
  return { changed, events: result.events };
}
