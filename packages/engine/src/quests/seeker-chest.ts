import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import { lootTableOf } from '../content/loot-tables.content';
import { grantToDraft, type IInventoryDraft } from '../inventory/apply-stock';
import type { InventoryState } from '../inventory/inventory-state';
import { lootStreamLabel, planLootSpread, rollLoot, type LootNeighbour } from '../loot';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import {
  AXIAL_DIRS,
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  hexDistance,
  offsetToAxial,
  type Axial,
} from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';
import { floorKeys, positionOf, type QuestRun, type SeekerBoard } from './quest-state';
import { reject, type SeekerResult } from './seeker-result';

export interface QuestChestContext {
  inventory: InventoryState | undefined;
  tableId: string | undefined;
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
  return AXIAL_DIRS.flatMap((dir) => {
    const hex = { q: target.q + dir.q, r: target.r + dir.r };
    const key = coordinateKey(axialToOffset(hex));
    return floor.has(key) ? [{ hex, free: !taken.has(key) }] : [];
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
  const table = lootTableOf(context.tableId);
  const drops = table
    ? rollLoot(
        table,
        deriveStream(source.seed, lootStreamLabel(source.seed, coordinateKey(chest.hex))),
      )
    : [];
  const draft: IInventoryDraft = { current: context.inventory, events: [] };
  const spread = planLootSpread({
    target,
    entry: offsetToAxial(entry),
    neighbours: questLootNeighbours(source, board, target),
    lists: [drops],
    bag: draft,
  });
  if (!spread.ok) return reject(progress, source, spread.reason);

  const placed = spread.plan.placements.map(({ hex, itemKey, amount }) => ({
    hex: axialToOffset(hex),
    itemKey,
    amount,
  }));
  for (const drop of spread.plan.toBag) grantToDraft(draft, drop.itemKey, drop.amount, 'loot');
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
      toBag: spread.plan.toBag,
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
  if (hexDistance(collect.hero, hex) !== 1) return reject(progress, source, 'NOT_ADJACENT');
  const item = collect.ground.find((candidate) => sameHex(candidate.hex, hex));
  if (!item) return reject(progress, source, 'NO_LOOT_THERE');
  const draft: IInventoryDraft = { current: inventory, events: [] };
  if (!grantToDraft(draft, item.itemKey as THexobjectKey, item.amount, 'pickup')) {
    return reject(progress, source, 'BAG_FULL');
  }
  const run = structuredClone(source);
  run.collect!.ground = collect.ground.filter(
    (candidate) => candidate !== item && !sameHex(candidate.hex, hex),
  );
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
