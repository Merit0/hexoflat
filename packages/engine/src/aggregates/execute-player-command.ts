import { resolveHeroStats } from '../tokens/equipment/hero-stats';
import { syncEquipmentWill } from '../knowledge/equipment-will';
import { HERO_BASE_HEALTH, HeroModel } from '../models/hero-model';
import type { DomainEvent } from '../commands/types';
import {
  applyConsumeItem,
  applyGrantItem,
  devTokenMint,
  type TokenSupply,
} from '../inventory/apply-stock';
import { applyInventoryCommand } from '../inventory/apply-inventory';
import type { InventoryContext } from '../inventory/inventory-commands';
import type { InventoryState } from '../inventory/inventory-state';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { toAggregate } from '../inventory/inventory-adapter';
import { countItem } from '../inventory/plan-stock';
import { mintSpecTokens } from '../tokens/token-spec';
import { replaceInventory } from './replace-inventory';
import { executeProgressCommand } from './execute-progress-command';
import { claimCampChest } from './claim-camp-chest';
import { ackGraveExitWarning } from './ack-grave-exit-warning';
import { applyTradeCommand, type TradeContext } from './apply-trade-command';
import { applyQuestCommand, type QuestApplyContext } from './apply-quest-command';
import { foldQuestEvents } from '../quests/quest-hook';
import type { PlayerCommand } from './player-commands';
import type { ProgressState } from './progress-state';

export interface PlayerAggregates {
  inventory: InventoryState;
  progress: ProgressState;
}

export interface PlayerCommandContext {
  devGrantAllowed: boolean;
  inventory: InventoryContext;
  trade?: TradeContext;
  quest?: QuestApplyContext;
  rngSeed?: string;
}

export function serverSecretOf(ctx: { rngSeed?: string }): string {
  if (!ctx.rngSeed) throw new Error('NO_SERVER_SECRET');
  return ctx.rngSeed;
}

export type PlayerCommandOutcome =
  | { ok: true; changed: Partial<PlayerAggregates>; events: DomainEvent[] }
  | { ok: false; code: string; events: DomainEvent[] };

const REJECTION_TYPES: ReadonlySet<string> = new Set([
  'ITEM_TRANSFER_REJECTED',
  'ITEM_GRANT_REJECTED',
  'ITEM_CONSUME_REJECTED',
  'REWARD_REJECTED',
  'TRADE_REJECTED',
  'QUEST_REJECTED',
]);

function rejectionOf(events: readonly DomainEvent[]): PlayerCommandOutcome | null {
  const event = events.find((candidate) => REJECTION_TYPES.has(candidate.type));
  if (!event) return null;
  const reason = (event.payload as { reason?: unknown } | undefined)?.reason;
  return { ok: false, code: typeof reason === 'string' ? reason : 'REJECTED', events: [...events] };
}

function inventoryOutcome(
  before: InventoryState,
  after: InventoryState | undefined,
  events: DomainEvent[],
): PlayerCommandOutcome {
  const rejected = rejectionOf(events);
  if (rejected) return rejected;
  const changed: Partial<PlayerAggregates> = after && after !== before ? { inventory: after } : {};
  return { ok: true, changed, events };
}

export function executePlayerCommand(
  aggregates: PlayerAggregates,
  command: PlayerCommand,
  ctx: PlayerCommandContext,
): PlayerCommandOutcome {
  const outcome = foldQuest(aggregates, executeCore(aggregates, command, ctx));
  if (!outcome.ok || !outcome.changed.inventory) return outcome;
  const progress = outcome.changed.progress ?? aggregates.progress;
  const stats = resolveHeroStats(Object.values(outcome.changed.inventory.equip));
  const bonus = stats.maxHearts / 2;
  const will = syncEquipmentWill(progress.knowledge, stats);
  if (bonus === progress.health.bonus && will.knowledge === progress.knowledge) return outcome;
  const model = new HeroModel().setMaxHealth(HERO_BASE_HEALTH).restoreHealth(progress.health);
  model.setMaxHealthBonus(bonus);
  return {
    ...outcome,
    changed: {
      ...outcome.changed,
      progress: { ...progress, health: model.healthState(), knowledge: will.knowledge },
    },
    events: [...outcome.events, ...will.events],
  };
}

function foldQuest(
  aggregates: PlayerAggregates,
  outcome: PlayerCommandOutcome,
): PlayerCommandOutcome {
  if (!outcome.ok) return outcome;
  const progress = outcome.changed.progress ?? aggregates.progress;
  const folded = foldQuestEvents(
    { progress, events: outcome.events },
    aggregates.progress.presence?.locationKey,
  );
  if (folded.progress === progress) return outcome;
  return {
    ...outcome,
    changed: { ...outcome.changed, progress: folded.progress },
    events: folded.events,
  };
}

function executeCore(
  aggregates: PlayerAggregates,
  command: PlayerCommand,
  ctx: PlayerCommandContext,
): PlayerCommandOutcome {
  const { inventory, progress } = aggregates;
  switch (command.type) {
    case 'CLAIM_CAMP_CHEST': {
      const result = claimCampChest(
        inventory,
        progress,
        command.payload.revision,
        serverSecretOf(ctx),
      );
      if (!result.ok) return rejectionOf(result.events) as PlayerCommandOutcome;
      return {
        ok: true,
        changed: { inventory: result.inventory, progress: result.progress },
        events: result.events,
      };
    }
    case 'DEV_GRANT_ITEM': {
      if (!ctx.devGrantAllowed) {
        return { ok: false, code: 'FORBIDDEN', events: [] };
      }
      const { heroId, revision, key, amount, token } = command.payload;
      const minted = token
        ? mintSpecTokens(token, { heroId, idSeq: inventory.idSeq, amount })
        : null;
      if (minted && !minted.ok) return { ok: false, code: minted.refusal.code, events: [] };
      const result = applyGrantItem(
        inventory,
        { type: 'GRANT_ITEM', payload: { heroId, revision, key: key, amount, source: 'dev' } },
        minted ? { tokens: minted.value } : { mint: devTokenMint(inventory) },
      );
      return inventoryOutcome(inventory, result.inventory, result.events);
    }
    case 'DEV_CONSUME_ITEM': {
      if (!ctx.devGrantAllowed) {
        return { ok: false, code: 'FORBIDDEN', events: [] };
      }
      const { heroId, revision, key, amount } = command.payload;
      const result = applyConsumeItem(inventory, {
        type: 'CONSUME_ITEM',
        payload: { heroId, revision, key: key, amount },
      });
      return inventoryOutcome(inventory, result.inventory, result.events);
    }
    case 'DEV_SET_INVENTORY': {
      if (!ctx.devGrantAllowed) {
        return { ok: false, code: 'FORBIDDEN', events: [] };
      }
      const result = replaceInventory(
        inventory,
        command.payload as unknown as Parameters<typeof replaceInventory>[1],
      );
      return inventoryOutcome(inventory, result.inventory, result.events);
    }
    case 'KNOWLEDGE':
    case 'SACRIFICE_TO_SKILL':
    case 'RESET_SKILLS':
    case 'ARRIVE':
    case 'DEV_SET_HEALTH':
    case 'SPEND_WILL':
    case 'DEV_GRANT_WILL':
    case 'DEV_SET_KNOWLEDGE': {
      const outcome = executeProgressCommand(progress, command, ctx.devGrantAllowed, inventory);
      if (!outcome) return { ok: false, code: 'UNKNOWN_COMMAND', events: [] };
      return outcome.ok
        ? { ok: true, changed: { progress: outcome.progress }, events: outcome.events }
        : outcome;
    }
    case 'SHOP_BUY':
    case 'SHOP_SELL':
    case 'SHOP_BUY_BACK_UNIQUE':
    case 'SHOP_DEAL':
    case 'SHOP_LIST':
    case 'SHOP_UNLIST':
    case 'SHOP_REPRICE':
    case 'SHOP_REFRESH': {
      const result = applyTradeCommand(aggregates, command, ctx);
      return (
        rejectionOf(result.events) ?? { ok: true, changed: result.changed, events: result.events }
      );
    }
    case 'ACK_GRAVE_EXIT_WARNING': {
      const acknowledged = ackGraveExitWarning(progress);
      return { ok: true, changed: acknowledged.changed, events: acknowledged.events };
    }
    case 'QUEST_ACCEPT':
    case 'QUEST_ABANDON':
    case 'QUEST_CLAIM':
    case 'QUEST_BOARD_SYNC':
    case 'QUEST_BOARD_REFRESH': {
      const result = applyQuestCommand(aggregates, command, {
        ...ctx.quest,
        atBoard: ctx.quest?.atBoard ?? false,
        rngSeed: ctx.rngSeed,
      });
      return (
        rejectionOf(result.events) ?? { ok: true, changed: result.changed, events: result.events }
      );
    }
    default: {
      const result = applyInventoryCommand(inventory, command, ctx.inventory);
      return inventoryOutcome(inventory, result.inventory, result.events);
    }
  }
}

export function grantItemServerSide(
  inventory: InventoryState,
  key: THexobjectKey,
  amount: number,
  source: 'pickup' | 'loot' | 'reward' | 'dev',
  supply?: TokenSupply,
): PlayerCommandOutcome {
  const result = applyGrantItem(
    inventory,
    {
      type: 'GRANT_ITEM',
      payload: { heroId: inventory.heroId, revision: inventory.revision, key, amount, source },
    },
    supply,
  );
  return inventoryOutcome(inventory, result.inventory, result.events);
}

export function consumeItemServerSide(
  inventory: InventoryState,
  key: THexobjectKey,
  amount: number,
): PlayerCommandOutcome {
  const result = applyConsumeItem(inventory, {
    type: 'CONSUME_ITEM',
    payload: { heroId: inventory.heroId, revision: inventory.revision, key, amount },
  });
  return inventoryOutcome(inventory, result.inventory, result.events);
}

export function heldAmount(inventory: InventoryState, key: string): number {
  return countItem(toAggregate(inventory), key as THexobjectKey);
}
