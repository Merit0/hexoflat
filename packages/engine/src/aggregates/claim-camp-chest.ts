import type { DomainEvent } from '../commands/types';
import { CAMP_CHEST_ITEMS, STASH_CHEST_CELLS } from '../inventory/stash-constants';
import { mintItem, type InventoryState } from '../inventory/inventory-state';
import { CAMP_FIRST_CHEST_REWARD, type ProgressState } from './progress-state';

export type ClaimRejectReason = 'INVENTORY_STALE' | 'ALREADY_CLAIMED';

export type ClaimCampChestResult =
  | { ok: true; inventory: InventoryState; progress: ProgressState; events: DomainEvent[] }
  | { ok: false; reason: ClaimRejectReason; events: DomainEvent[] };

function refused(heroId: string, reason: ClaimRejectReason): ClaimCampChestResult {
  return {
    ok: false,
    reason,
    events: [
      { type: 'REWARD_REJECTED', payload: { heroId, reward: CAMP_FIRST_CHEST_REWARD, reason } },
    ],
  };
}

export function claimCampChest(
  inventory: InventoryState,
  progress: ProgressState,
  revision: number,
): ClaimCampChestResult {
  const heroId = inventory.heroId;
  if (inventory.revision !== revision) return refused(heroId, 'INVENTORY_STALE');
  if (progress.claimedRewards.includes(CAMP_FIRST_CHEST_REWARD) || inventory.stash.chests !== 0) {
    return refused(heroId, 'ALREADY_CLAIMED');
  }

  const seq = { heroId, idSeq: inventory.idSeq };
  const cells = inventory.stash.cells.slice();
  const granted: DomainEvent[] = [];
  CAMP_CHEST_ITEMS.forEach((key, index) => {
    if (index >= STASH_CHEST_CELLS) return;
    cells[index] = mintItem(seq, key, 1);
    granted.push({
      type: 'ITEM_GRANTED',
      payload: {
        heroId,
        key,
        amount: 1,
        source: 'reward',
        placedAt: { container: 'stash', index },
      },
    });
  });

  const next: InventoryState = {
    ...inventory,
    revision: inventory.revision + 1,
    idSeq: seq.idSeq,
    stash: { chests: 1, cells },
  };
  return {
    ok: true,
    inventory: next,
    progress: {
      ...progress,
      claimedRewards: [...progress.claimedRewards, CAMP_FIRST_CHEST_REWARD],
    },
    events: [
      ...granted,
      { type: 'INVENTORY_CHANGED', payload: { heroId, revision: next.revision } },
      { type: 'REWARD_CLAIMED', payload: { heroId, reward: CAMP_FIRST_CHEST_REWARD } },
    ],
  };
}
