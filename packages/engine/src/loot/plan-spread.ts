import type { LootDrop } from './loot-table';
import { placeLoot, type LootNeighbour } from './place-loot';
import type { Axial } from '../utils/hex-utils';
import { grantToDraft, type IInventoryDraft } from '../inventory/apply-stock';
import { withToken } from '../tokens/token-entry';

export interface LootSpreadInput {
  target: Axial;
  entry: Axial;
  neighbours: readonly LootNeighbour[];
  lists: readonly (readonly LootDrop[])[];
  bag: IInventoryDraft;
}

export interface SpreadDrop {
  itemKey: LootDrop['itemKey'];
  amount: number;
  token?: LootDrop['token'];
}

export interface LootSpreadPlan {
  placements: (SpreadDrop & { hex: Axial })[];
  toBag: SpreadDrop[];
}

export type LootSpreadResult =
  { ok: true; plan: LootSpreadPlan } | { ok: false; reason: 'NO_ROOM_FOR_LOOT' | 'BAG_FULL' };

export const EMPTY_LOOT_SPREAD: LootSpreadPlan = { placements: [], toBag: [] };

export function grantDrop(draft: IInventoryDraft, drop: SpreadDrop): boolean {
  return grantToDraft(draft, drop.itemKey, drop.amount, 'loot', { tokens: [drop.token] });
}

export function bagTakesAll(draft: IInventoryDraft, drops: readonly SpreadDrop[]): boolean {
  const trial: IInventoryDraft = { current: draft.current, events: [] };
  return drops.every((drop) => grantDrop(trial, drop));
}

export function planLootSpread(input: LootSpreadInput): LootSpreadResult {
  if (input.lists.every((list) => list.length === 0)) return { ok: true, plan: EMPTY_LOOT_SPREAD };
  const result = placeLoot({
    target: input.target,
    entry: input.entry,
    neighbours: input.neighbours,
    drops: input.lists,
  });
  if (result.kind === 'refused') return { ok: false, reason: result.refusal.reason };
  if (!bagTakesAll(input.bag, result.toBag)) return { ok: false, reason: 'BAG_FULL' };
  return {
    ok: true,
    plan: {
      placements: result.placements.map(({ hex, itemKey, amount, token }) =>
        withToken({ hex, itemKey, amount }, token),
      ),
      toBag: result.toBag.map(({ itemKey, amount, token }) =>
        withToken({ itemKey, amount }, token),
      ),
    },
  };
}
