import type { HexEngineCommand } from '@hexoflat/engine/commands/hex-engine-commands';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import type {
  IInventoryAggregate,
  TTransferKind,
  TTransferResult,
} from '@hexoflat/engine/inventory/item-transfer';
import type { TUnlockChestError } from '@hexoflat/engine/inventory/plan-unlock-chest';
import { toAggregate as stateToAggregate } from '@hexoflat/engine/inventory/inventory-adapter';
import { stashChestPrice } from '@hexoflat/engine/inventory/stash-constants';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { battleOpen } from './inventory-moves';
import { dispatchInventory, readInventoryState, type DispatchResult } from './inventory-store-io';

type TBase = { heroId: string; revision: number };

export type TUnlockOutcome =
  | { ok: true; next: IInventoryAggregate; chests: number; price: number }
  | { ok: false; reason: TUnlockChestError; price: number | null };

function stores() {
  return { inventory: useHeroInventoryStore(), stash: useHeroStashStore() };
}

export function readInventoryAggregate(): IInventoryAggregate {
  return stateToAggregate(readInventoryState(stores()));
}

function send(build: (base: TBase) => HexEngineCommand, commit: boolean): DispatchResult {
  const { stash } = stores();
  return dispatchInventory(
    stores(),
    build,
    { stashOpen: stash.isOpen, battleOpen: battleOpen() },
    { commit },
  );
}

function asTransfer(result: DispatchResult): TTransferResult {
  const moved = result.events.find((event) => event.type === 'ITEM_MOVED');
  const stored = result.events.find((event) => event.type === 'STASH_RESOURCES_STORED');
  const sorted = result.events.find((event) => event.type === 'STASH_SORTED');
  const next = stateToAggregate(result.after);
  if (result.ok && result.after === result.before)
    return { ok: true, next, kind: 'noop', moved: 0 };
  if (result.ok && moved) {
    const payload = moved.payload as { kind: TTransferKind; moved: number };
    return { ok: true, next, kind: payload.kind, moved: payload.moved };
  }
  if (result.ok && stored) {
    return { ok: true, next, kind: 'store', moved: (stored.payload as { stacks: number }).stacks };
  }
  if (result.ok && sorted) {
    return { ok: true, next, kind: 'sort', moved: (sorted.payload as { merged: number }).merged };
  }
  if (result.ok) return { ok: true, next, kind: 'noop', moved: 0 };
  return { ok: false, reason: result.reason as never };
}

const moveCommand =
  (from: TItemLocation, to: TItemLocation, split: boolean) =>
  ({ heroId, revision }: TBase) => ({
    type: 'MOVE_ITEM' as const,
    payload: { heroId, revision, from, to, split },
  });

const autoPlaceCommand =
  (from: TItemLocation, toContainer: 'bag' | 'stash', split: boolean, preferredChest: number) =>
  ({ heroId, revision }: TBase) => ({
    type: 'AUTO_PLACE_ITEM' as const,
    payload: { heroId, revision, from, toContainer, split, preferredChest },
  });

export function previewMove(from: TItemLocation, to: TItemLocation, split = false) {
  return asTransfer(send(moveCommand(from, to, split), false));
}

export function previewAutoPlace(from: TItemLocation, toContainer: 'bag' | 'stash', split = false) {
  const chest = useHeroStashStore().activeChest;
  return asTransfer(send(autoPlaceCommand(from, toContainer, split, chest), false));
}

export function moveItem(from: TItemLocation, to: TItemLocation, split = false) {
  return asTransfer(send(moveCommand(from, to, split), true));
}

export function autoPlaceItem(from: TItemLocation, toContainer: 'bag' | 'stash', split = false) {
  const chest = useHeroStashStore().activeChest;
  return asTransfer(send(autoPlaceCommand(from, toContainer, split, chest), true));
}

export function unlockNextChest(): TUnlockOutcome {
  const stash = useHeroStashStore();
  const result = send(
    ({ heroId, revision }) => ({
      type: 'UNLOCK_STASH_CHEST' as const,
      payload: { heroId, revision },
    }),
    true,
  );
  const unlocked = result.events.find((event) => event.type === 'STASH_CHEST_UNLOCKED');
  if (result.ok && unlocked) {
    const { chests, price } = unlocked.payload as { chests: number; price: number };
    stash.selectChest(chests - 1);
    return { ok: true, next: stateToAggregate(result.after), chests, price };
  }
  const rejected = result.events.find((event) => event.type === 'ITEM_TRANSFER_REJECTED');
  const payload = rejected?.payload as { reason: TUnlockChestError; price?: number | null };
  return {
    ok: false,
    reason: payload?.reason ?? 'NO_COINS_IN_HAND',
    price: payload?.price ?? stashChestPrice(stash.chests),
  };
}

export function storeResources() {
  const chest = useHeroStashStore().activeChest;
  return asTransfer(
    send(
      ({ heroId, revision }) => ({
        type: 'STORE_RESOURCES' as const,
        payload: { heroId, revision, preferredChest: chest },
      }),
      true,
    ),
  );
}

export function sortStash() {
  return asTransfer(
    send(
      ({ heroId, revision }) => ({ type: 'SORT_STASH' as const, payload: { heroId, revision } }),
      true,
    ),
  );
}
