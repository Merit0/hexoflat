import { tokenTypeOfDimension } from '../dimensions/dimensions';
import { dropAvailableIn } from '../loot/dimension-pool';
import { baseTokenTypeSchema } from '../tokens/token-keys';
import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import { consumeFromDraft, countInDraft, grantToDraft } from '../inventory/apply-stock';
import { DEFAULT_MAP_TIER, type DropContext } from '../tokens/drop-context';
import { isTokenType, tokenSourceIdOf, type TokenMint } from '../tokens/game-tokens';
import type { IInventoryDraft } from '../inventory/apply-stock';
import type { InventoryState } from '../inventory/inventory-state';
import { grantWill, spendWill } from '../knowledge/will';
import { handlerFor, OBJECTIVES, type ObjectiveRegistry } from './objectives';
import type { QuestLog } from './quest-log-state';
import { questDefinitionFor } from './quest-lookup';
import { questOfferFor, removeQuest } from './quest-board-state';
import type { LocationKey } from '../registry/location-key';
import {
  QUEST_SLOTS,
  questDimension,
  type QuestCatalogue,
  type QuestBoardRefusal,
  type QuestDefinition,
  type QuestRefusal,
  type QuestSlots,
} from './quest-definition';

export interface QuestContext {
  catalogue: QuestCatalogue;
  atBoard: boolean;
  slots?: QuestSlots;
  freeSlots?: number;
  rngSeed?: string;
  dayId?: number;
}

export type QuestPlan =
  | {
      ok: true;
      progress: ProgressState;
      inventory: InventoryState | undefined;
      events: DomainEvent[];
    }
  | { ok: false; reason: QuestRefusal | QuestBoardRefusal; events: DomainEvent[] };

export type QuestBoardState = 'open' | 'locked' | 'taken' | 'finished';

function reject(
  progress: ProgressState,
  questId: string,
  reason: QuestRefusal | QuestBoardRefusal,
  detail?: Record<string, number>,
): QuestPlan {
  return {
    ok: false,
    reason,
    events: [
      {
        type: 'QUEST_REJECTED',
        payload: { heroId: progress.knowledge.heroId, questId, reason, ...detail },
      },
    ],
  };
}

export function unmetRequirements(log: QuestLog, quest: QuestDefinition): boolean {
  return quest.requires.some((requirement) => (log.done[requirement.questId] ?? 0) < 1);
}

export function questBoardState(log: QuestLog, quest: QuestDefinition): QuestBoardState {
  if (log.active.some((entry) => entry.questId === quest.id)) return 'taken';
  if (quest.repeat === 'once' && (log.done[quest.id] ?? 0) >= 1) return 'finished';
  return unmetRequirements(log, quest) ? 'locked' : 'open';
}

export function slotSurcharge(
  activeCount: number,
  slots: QuestSlots = QUEST_SLOTS,
  freeSlots = 0,
): number | null {
  if (activeCount >= slots.max) return null;
  if (activeCount < slots.base) return 0;
  const index = activeCount - slots.base;
  return index < freeSlots ? 0 : (slots.extraCost[index] ?? 0);
}

export function planAccept(
  progress: ProgressState,
  inventory: InventoryState | undefined,
  questId: string,
  ctx: QuestContext,
): QuestPlan {
  const log = progress.quests;
  const quest = questDefinitionFor(log, questId, ctx.catalogue);
  if (!quest)
    return reject(
      progress,
      questId,
      questId.startsWith('qo-') ? 'QUEST_OFFER_EXPIRED' : 'UNKNOWN_QUEST',
    );
  if (!ctx.atBoard) return reject(progress, questId, 'NOT_AT_BOARD');
  const offer = questOfferFor(log, questId);
  if (log.board && !offer) return reject(progress, questId, 'QUEST_OFFER_REQUIRED');
  if (offer && offer.dayId !== (ctx.dayId ?? progress.day?.id))
    return reject(progress, questId, 'QUEST_OFFER_EXPIRED');
  if (
    log.active.some(
      (entry) => questDefinitionFor(log, entry.questId, ctx.catalogue)?.id === quest.id,
    )
  )
    return reject(progress, questId, 'QUEST_ALREADY_ACTIVE');
  const state = questBoardState(log, quest);
  if (state === 'taken') return reject(progress, questId, 'QUEST_ALREADY_ACTIVE');
  if (state !== 'open') return reject(progress, questId, 'REQUIREMENTS_NOT_MET');
  const surcharge = slotSurcharge(log.active.length, ctx.slots, ctx.freeSlots);
  if (surcharge === null) return reject(progress, questId, 'QUEST_SLOTS_FULL');
  const price = (quest.accept.kind === 'will' ? quest.accept.amount : 0) + surcharge;
  const have = progress.knowledge.current;
  if (price > have) return reject(progress, questId, 'INSUFFICIENT_WILL', { cost: price, have });

  const draft: IInventoryDraft = { current: inventory, events: [] };
  if (quest.accept.kind === 'item') {
    const key = quest.accept.itemKey;
    if (countInDraft(draft, key) < quest.accept.amount) {
      return reject(progress, questId, 'INSUFFICIENT_ITEMS');
    }
    consumeFromDraft(draft, key, quest.accept.amount);
  }

  const next = structuredClone(progress);
  const events: DomainEvent[] = [...draft.events];
  if (price > 0) {
    events.push(...spendWill(next.knowledge, price, 'quest', `quest:${questId}`).events);
    next.knowledge.revision++;
  }
  next.quests.active.push({ questId, progress: 0, state: 'active' });
  if (quest.mapObjectPlacement) {
    const activations = (next.quests.placementActivations ??= {});
    activations[questId] = (activations[questId] ?? 0) + 1;
  }
  events.push({
    type: 'QUEST_ACCEPTED',
    payload: {
      heroId: next.knowledge.heroId,
      questId,
      slot: log.active.length + 1,
      willPaid: price,
    },
  });
  return { ok: true, progress: next, inventory: draft.current, events };
}

export function planAbandon(
  progress: ProgressState,
  inventory: InventoryState | undefined,
  questId: string,
): QuestPlan {
  if (!progress.quests.active.some((entry) => entry.questId === questId)) {
    return reject(progress, questId, 'NOT_ACTIVE');
  }
  const next = structuredClone(progress);
  const offer = questOfferFor(next.quests, questId);
  removeQuest(next.quests, questId, offer?.dayId !== next.day?.id);
  return {
    ok: true,
    progress: next,
    inventory,
    events: [{ type: 'QUEST_ABANDONED', payload: { heroId: next.knowledge.heroId, questId } }],
  };
}

function rewardMint(
  progress: ProgressState,
  questId: string,
  rngSeed: string | undefined,
  rewardIndex: number,
  dropContext: DropContext,
): TokenMint {
  if (!rngSeed) throw new Error('NO_SERVER_SECRET');
  const heroId = progress.knowledge.heroId;
  const times = progress.quests.done[questId] ?? 0;
  return {
    seed: rngSeed,
    sourceId: tokenSourceIdOf('quest', questId, heroId, String(times), String(rewardIndex)),
    dropContext,
  };
}

export function planClaim(
  progress: ProgressState,
  inventory: InventoryState | undefined,
  questId: string,
  ctx: QuestContext,
): QuestPlan {
  const quest = questDefinitionFor(progress.quests, questId, ctx.catalogue);
  if (!quest) return reject(progress, questId, 'UNKNOWN_QUEST');
  if (!ctx.atBoard) return reject(progress, questId, 'NOT_AT_BOARD');
  const entry = progress.quests.active.find((candidate) => candidate.questId === questId);
  if (!entry) return reject(progress, questId, 'NOT_ACTIVE');
  if (quest.turnIn === 'auto') return reject(progress, questId, 'AUTO_TURN_IN');
  if (entry.state !== 'ready') return reject(progress, questId, 'NOT_READY');

  const next = structuredClone(progress);
  const draft: IInventoryDraft = { current: inventory, events: [] };
  const events: DomainEvent[] = [];
  for (const [rewardIndex, reward] of quest.rewards.entries()) {
    if (reward.kind === 'item') {
      if (!inventory) return reject(progress, questId, 'NO_INVENTORY');
      const dimension = questDimension(quest);
      const dropContext: DropContext = {
        tokenType: baseTokenTypeSchema.parse(tokenTypeOfDimension(dimension)),
        mapTier: quest.rewardDropContext?.mapTier ?? DEFAULT_MAP_TIER,
      };
      if (!dropAvailableIn({ itemKey: reward.itemKey, baseKey: reward.token?.baseKey }, dimension))
        throw new Error(`QUEST_REWARD_OUTSIDE_DIMENSION: ${questId}:${reward.itemKey}`);
      const supply = reward.token
        ? { tokens: [reward.token] }
        : isTokenType(reward.itemKey)
          ? {
              mint: rewardMint(progress, questId, ctx.rngSeed, rewardIndex, dropContext),
            }
          : undefined;
      if (!grantToDraft(draft, reward.itemKey, reward.amount, 'reward', supply)) {
        return reject(progress, questId, 'BAG_FULL');
      }
      continue;
    }
    const granted = grantWill(next.knowledge, reward.amount, {
      kind: 'quest',
      ref: `quest:${questId}`,
    });
    if (granted.length > 0) next.knowledge.revision++;
    events.push(...granted);
  }
  removeQuest(next.quests, questId);
  next.quests.done[quest.id] = (next.quests.done[quest.id] ?? 0) + 1;
  events.unshift(...draft.events);
  events.push({
    type: 'QUEST_CLAIMED',
    payload: { heroId: next.knowledge.heroId, questId, times: next.quests.done[quest.id] },
  });
  return { ok: true, progress: next, inventory: draft.current, events };
}

export function applyQuestEvents(
  progress: ProgressState,
  incoming: readonly DomainEvent[],
  catalogue: QuestCatalogue,
  registry: ObjectiveRegistry = OBJECTIVES,
  locationKey?: LocationKey,
): { progress: ProgressState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  let active = progress.quests.active;
  for (const event of incoming) {
    active = active.map((entry) => {
      const quest = questDefinitionFor(progress.quests, entry.questId, catalogue);
      if (!quest || entry.state !== 'active') return entry;
      if (quest.id !== entry.questId && (!locationKey || !quest.locations.includes(locationKey)))
        return entry;
      const payload = event.payload;
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('dimension' in payload) ||
        payload.dimension !== questDimension(quest)
      )
        return entry;
      const handler = handlerFor(quest.objective, registry);
      const advanced = handler.onEvent(quest.objective, entry.progress, event);
      if (advanced === entry.progress) return entry;
      const ready = handler.isComplete(quest.objective, advanced);
      if (ready) {
        events.push({
          type: 'QUEST_READY',
          payload: { heroId: progress.knowledge.heroId, questId: entry.questId },
        });
      }
      return { ...entry, progress: advanced, state: ready ? ('ready' as const) : entry.state };
    });
  }
  if (active.every((entry, index) => entry === progress.quests.active[index])) {
    return { progress, events };
  }
  return { progress: { ...progress, quests: { ...progress.quests, active } }, events };
}
