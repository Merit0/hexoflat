import type { DomainEvent } from '../commands/types';
import { coinHandSlot, planUnlockStashChest } from './plan-unlock-chest';
import { planItemAutoPlace } from './plan-auto-place';
import { planItemMove } from './plan-item-move';
import { planSortStash, planStoreResources } from './plan-stash-actions';
import { applyAggregate, chestRange, toAggregate } from './inventory-adapter';
import type {
  InventoryCommand,
  InventoryContext,
  InventoryRejectReason,
} from './inventory-commands';
import type { InventoryState } from './inventory-state';
import type { TItemLocation } from './item-location';
import type { IInventoryAggregate, ITransferOptions, TTransferResult } from './transfer-types';

export interface InventoryApplyResult {
  inventory: InventoryState | undefined;
  events: DomainEvent[];
}

const NO_CONTEXT: InventoryContext = { stashOpen: false, battleOpen: false };

function rejected(
  heroId: string,
  command: InventoryCommand['type'],
  reason: InventoryRejectReason,
  extra: Record<string, unknown> = {},
): DomainEvent {
  return { type: 'ITEM_TRANSFER_REJECTED', payload: { heroId, command, reason, ...extra } };
}

function isHand(location: TItemLocation): boolean {
  return (
    location.container === 'equip' && (location.slot === 'weapon' || location.slot === 'shield')
  );
}

function touchesHands(command: InventoryCommand): boolean {
  switch (command.type) {
    case 'MOVE_ITEM':
      return isHand(command.payload.from) || isHand(command.payload.to);
    case 'AUTO_PLACE_ITEM':
      return isHand(command.payload.from);
    default:
      return false;
  }
}

function transferOptions(
  state: InventoryState,
  ctx: InventoryContext,
  seq: { next: number },
  split: boolean,
  preferredChest?: number,
): ITransferOptions {
  return {
    split,
    capacityKg: state.capacityKg,
    stashOpen: ctx.stashOpen,
    stashPreferred: chestRange(preferredChest),
    newId: () => `${state.heroId}:${seq.next++}`,
  };
}

type TransferCommand = Exclude<InventoryCommand, { type: 'UNLOCK_STASH_CHEST' }>;

function plan(
  command: TransferCommand,
  state: InventoryState,
  agg: IInventoryAggregate,
  ctx: InventoryContext,
  seq: { next: number },
): TTransferResult {
  switch (command.type) {
    case 'MOVE_ITEM': {
      const { from, to, split } = command.payload;
      return planItemMove(agg, from, to, transferOptions(state, ctx, seq, split));
    }
    case 'AUTO_PLACE_ITEM': {
      const { from, toContainer, split, preferredChest } = command.payload;
      const opts = transferOptions(state, ctx, seq, split, preferredChest);
      return planItemAutoPlace(agg, from, toContainer, opts);
    }
    case 'STORE_RESOURCES': {
      const range = chestRange(command.payload.preferredChest);
      return planStoreResources(agg, { stashOpen: ctx.stashOpen, stashPreferred: range });
    }
    case 'SORT_STASH':
      return planSortStash(agg, { stashOpen: ctx.stashOpen });
  }
}

function transferEvent(
  command: InventoryCommand,
  heroId: string,
  result: TTransferResult & { ok: true },
) {
  const { kind, moved } = result;
  switch (command.type) {
    case 'MOVE_ITEM':
      return {
        type: 'ITEM_MOVED',
        payload: { heroId, from: command.payload.from, to: command.payload.to, kind, moved },
      };
    case 'AUTO_PLACE_ITEM':
      return {
        type: 'ITEM_MOVED',
        payload: {
          heroId,
          from: command.payload.from,
          to: { container: command.payload.toContainer },
          kind,
          moved,
        },
      };
    case 'STORE_RESOURCES':
      return { type: 'STASH_RESOURCES_STORED', payload: { heroId, stacks: moved } };
    default:
      return { type: 'STASH_SORTED', payload: { heroId, merged: moved } };
  }
}

function commit(state: InventoryState, next: InventoryState, seq: number, events: DomainEvent[]) {
  const committed = { ...next, idSeq: seq, revision: state.revision + 1 };
  return {
    inventory: committed,
    events: [
      ...events,
      {
        type: 'INVENTORY_CHANGED',
        payload: { heroId: state.heroId, revision: committed.revision },
      },
    ],
  };
}

function applyUnlock(state: InventoryState): InventoryApplyResult {
  const agg = toAggregate(state);
  const slot = coinHandSlot(agg);
  const result = planUnlockStashChest(agg, state.stash.chests, slot ?? 'weapon');
  if (!result.ok) {
    return {
      inventory: state,
      events: [
        rejected(state.heroId, 'UNLOCK_STASH_CHEST', result.reason, { price: result.price }),
      ],
    };
  }
  const event = {
    type: 'STASH_CHEST_UNLOCKED',
    payload: { heroId: state.heroId, chests: result.chests, price: result.price },
  };
  return commit(state, applyAggregate(state, result.next), state.idSeq, [event]);
}

/**
 * Pure orchestration: checks the hero and revision, then asks the matching `plan*` rule. A
 * refusal returns the very same state plus one `ITEM_TRANSFER_REJECTED`; a success bumps the
 * revision and emits the specific event followed by `INVENTORY_CHANGED`. A `noop` plan changes
 * nothing, so the revision stays.
 */
export function applyInventoryCommand(
  state: InventoryState | undefined,
  command: InventoryCommand,
  context: InventoryContext = NO_CONTEXT,
): InventoryApplyResult {
  const { heroId, revision } = command.payload;
  if (!state || state.heroId !== heroId) {
    return { inventory: state, events: [rejected(heroId, command.type, 'NO_INVENTORY')] };
  }
  if (state.revision !== revision) {
    return { inventory: state, events: [rejected(heroId, command.type, 'INVENTORY_STALE')] };
  }
  if (context.battleOpen && touchesHands(command)) {
    return { inventory: state, events: [rejected(heroId, command.type, 'HANDS_LOCKED')] };
  }
  if (command.type === 'UNLOCK_STASH_CHEST') return applyUnlock(state);

  const seq = { next: state.idSeq };
  const result = plan(command, state, toAggregate(state), context, seq);
  if (!result.ok) {
    return { inventory: state, events: [rejected(heroId, command.type, result.reason)] };
  }
  const event = transferEvent(command, heroId, result);
  if (result.kind === 'noop') return { inventory: state, events: [event] };
  return commit(state, applyAggregate(state, result.next), seq.next, [event]);
}
