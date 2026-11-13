import type { LootDrop } from './loot-table';
import { placeLoot, type LootNeighbour } from './place-loot';
import type { Axial } from '../utils/hex-utils';
import { grantToDraft, type IInventoryDraft } from '../inventory/apply-stock';

export interface LootSpreadInput {
  target: Axial;
  entry: Axial;
  neighbours: readonly LootNeighbour[];
  lists: readonly (readonly LootDrop[])[];
  bag: IInventoryDraft;
}

export interface LootSpreadPlan {
  placements: { hex: Axial; itemKey: LootDrop['itemKey']; amount: number }[];
  toBag: { itemKey: LootDrop['itemKey']; amount: number }[];
}

export type LootSpreadResult =
  { ok: true; plan: LootSpreadPlan } | { ok: false; reason: 'NO_ROOM_FOR_LOOT' | 'BAG_FULL' };

export const EMPTY_LOOT_SPREAD: LootSpreadPlan = { placements: [], toBag: [] };

export function bagTakesAll(draft: IInventoryDraft, drops: readonly LootDrop[]): boolean {
  const trial: IInventoryDraft = { current: draft.current, events: [] };
  return drops.every((drop) => grantToDraft(trial, drop.itemKey, drop.amount, 'loot'));
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
  if (result.kind === 'to-bag') {
    if (!bagTakesAll(input.bag, result.drops)) return { ok: false, reason: 'BAG_FULL' };
    return {
      ok: true,
      plan: {
        placements: [],
        toBag: result.drops.map(({ itemKey, amount }) => ({ itemKey, amount })),
      },
    };
  }
  return {
    ok: true,
    plan: {
      placements: result.placements.map(({ hex, itemKey, amount }) => ({ hex, itemKey, amount })),
      toBag: [],
    },
  };
}
