import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import { lootTableOf } from '../content/loot-tables.content';
import type { IInventoryDraft } from '../inventory/apply-stock';
import type { InventoryState } from '../inventory/inventory-state';
import {
  applySpreadPlan,
  lootNeighbours,
  offsetPlacement,
  pickupStack,
  planLootSpread,
  rollLootList,
  type LootDrop,
  type LootNeighbour,
} from '../loot';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import {
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  hexDistance,
  offsetToAxial,
  type Axial,
} from '../utils/hex-utils';
import { floorKeys, positionOf, type QuestRun, type SeekerBoard } from './quest-state';
import { reject, type SeekerResult } from './seeker-result';

export interface QuestChestContext {
  inventory: InventoryState | undefined;
  tableId: string | undefined;
}

export function generateChestDrop(input: {
  seed: string;
  chestHex: IHexCoordinates;
  tableId: string | undefined;
}): LootDrop[] {
  return rollLootList(lootTableOf(input.tableId), {
    seed: input.seed,
    sourceId: input.seed,
    targetKey: coordinateKey(input.chestHex),
  });
}

function sameHex(a: IHexCoordinates, b: IHexCoordinates): boolean {
  return coordinateKey(a) === coordinateKey(b);
}

export function questLootNeighbours(
  run: QuestRun,
  board: SeekerBoard,
  target: Axial,
): LootNeighbour[] {
  const floor = floorKeys(board);
  const taken = new Set((run.collect?.ground ?? []).map((item) => coordinateKey(item.hex)));
  taken.add(coordinateKey(positionOf(run)));
  if (run.chest) taken.add(coordinateKey(run.chest.hex));
  return lootNeighbours(target, (hex) => {
    const key = coordinateKey(axialToOffset(hex));
    return floor.has(key) ? !taken.has(key) : null;
  });
}

function seenAround(board: SeekerBoard, at: IHexCoordinates): string[] {
  const floor = floorKeys(board);
  return [at, ...getHexNeighbors(at)].map(coordinateKey).filter((key) => floor.has(key));
}

function openRealChest(
  progress: ProgressState,
  source: QuestRun,
  board: SeekerBoard,
  context: QuestChestContext,
): SeekerResult {
  if (!context.inventory) return reject(progress, source, 'NO_INVENTORY');
  const chest = source.chest!;
  const entry = positionOf(source);
  const target = offsetToAxial(chest.hex);
  const drops =
    chest.drop?.map((entry) => ({ ...entry, itemKey: entry.itemKey as THexobjectKey })) ??
    generateChestDrop({ seed: source.seed, chestHex: chest.hex, tableId: context.tableId });
  const draft: IInventoryDraft = { current: context.inventory, events: [] };
  const spread = planLootSpread({
    target,
    entry: offsetToAxial(entry),
    neighbours: questLootNeighbours(source, board, target),
    lists: [drops],
    bag: draft,
  });
  if (!spread.ok) return reject(progress, source, spread.reason);

  const { placed, toBag } = applySpreadPlan(spread.plan, draft, (placement) =>
    offsetPlacement(placement, 'hex'),
  );
  const run = structuredClone(source);
  run.phase = 'collect';
  run.collect = {
    hero: { ...chest.hex },
    ground: placed.map((item) => ({ ...item })),
    seen: seenAround(board, chest.hex),
  };
  const heroId = progress.knowledge.heroId;
  const opened: DomainEvent = {
    type: 'CHEST_OPENED',
    payload: {
      heroId,
      questId: run.offerId,
      hex: chest.hex,
      from: entry,
      placed,
      toBag,
    },
  };
  return { ok: true, progress, run, events: [opened, ...draft.events], inventory: draft.current };
}

export function seekerOpenChest(
  progress: ProgressState,
  source: QuestRun,
  board: SeekerBoard,
  context: QuestChestContext,
): SeekerResult {
  const chest = source.chest;
  if (source.collect && chest) {
    return reject(
      progress,
      source,
      sameHex(source.collect.hero, chest.hex) ? 'STANDING_ON_TARGET' : 'CHEST_EMPTY',
    );
  }
  if (source.phase !== 'walking') return reject(progress, source, 'WRONG_PHASE');
  if (!chest) return reject(progress, source, 'NO_CHEST');
  const near = getHexNeighbors(positionOf(source)).some((hex) => sameHex(hex, chest.hex));
  if (!near) return reject(progress, source, 'NOT_ADJACENT');
  if (chest.kind === 'real') return openRealChest(progress, source, board, context);
  const run = structuredClone(source);
  run.phase = 'ambush';
  return {
    ok: true,
    progress,
    run,
    events: [
      {
        type: 'AMBUSH_SPRUNG',
        payload: {
          heroId: progress.knowledge.heroId,
          questId: run.offerId,
          deviations: run.lines.length,
        },
      },
    ],
  };
}

export function seekerCollectStep(
  progress: ProgressState,
  source: QuestRun,
  hex: IHexCoordinates,
  board: SeekerBoard,
): SeekerResult {
  const collect = source.collect;
  if (!collect) return reject(progress, source, 'WRONG_PHASE');
  if (hexDistance(collect.hero, hex) !== 1) return reject(progress, source, 'NOT_ADJACENT');
  if (!floorKeys(board).has(coordinateKey(hex))) {
    return reject(progress, source, 'HEX_NOT_REVEALED');
  }
  const blocked =
    collect.ground.some((item) => sameHex(item.hex, hex)) ||
    (source.chest !== null && sameHex(source.chest.hex, hex));
  if (blocked) return reject(progress, source, 'HEX_BLOCKED');
  const run = structuredClone(source);
  run.collect!.hero = { ...hex };
  run.collect!.seen = [...new Set([...collect.seen, ...seenAround(board, hex)])];
  return {
    ok: true,
    progress,
    run,
    events: [
      {
        type: 'QUEST_MOVED',
        payload: { heroId: progress.knowledge.heroId, questId: run.offerId, hex },
      },
    ],
  };
}

export function seekerPickup(
  progress: ProgressState,
  source: QuestRun,
  hex: IHexCoordinates,
  inventory: InventoryState | undefined,
): SeekerResult {
  const collect = source.collect;
  if (source.phase !== 'collect' || !collect) return reject(progress, source, 'WRONG_PHASE');
  if (!inventory) return reject(progress, source, 'NO_INVENTORY');
  const draft: IInventoryDraft = { current: inventory, events: [] };
  const picked = pickupStack({
    stacks: collect.ground,
    isTarget: (candidate) => sameHex(candidate.hex, hex),
    adjacent: hexDistance(collect.hero, hex) === 1,
    order: 'adjacent-first',
    bag: draft,
  });
  if (!picked.ok) return reject(progress, source, picked.reason);
  const item = picked.stack;
  const run = structuredClone(source);
  run.collect!.ground = picked.remaining;
  const taken: DomainEvent = {
    type: 'QUEST_LOOT_TAKEN',
    payload: {
      heroId: progress.knowledge.heroId,
      questId: run.offerId,
      hex,
      itemKey: item.itemKey,
      amount: item.amount,
    },
  };
  return { ok: true, progress, run, events: [taken, ...draft.events], inventory: draft.current };
}
