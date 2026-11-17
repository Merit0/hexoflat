import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import { openInSpace, rollContainerContents } from '../containers';
import { DEFAULT_TOKEN_ORIGIN, type TokenOrigin } from '../tokens/token-origin';
import { questTokenOrigin } from './quest-token-origin';
import { lootTableOf } from '../content/loot-tables.content';
import type { IInventoryDraft } from '../inventory/apply-stock';
import type { InventoryState } from '../inventory/inventory-state';
import { lootNeighbours, pickupStack, type LootDrop, type LootNeighbour } from '../loot';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import {
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  hexDistance,
  type Axial,
} from '../utils/hex-utils';
import { floorKeys, positionOf, type QuestRun, type SeekerBoard } from './quest-state';
import { questChestSpace, type QuestChestOpening } from './quest-chest-space';
import { reject, type SeekerRefusal, type SeekerResult } from './seeker-result';

export interface QuestChestContext {
  inventory: InventoryState | undefined;
  tableId: string | undefined;
}

export function generateChestDrop(input: {
  seed: string;
  chestHex: IHexCoordinates;
  tableId: string | undefined;
  origin?: TokenOrigin;
}): LootDrop[] {
  const [drops] = rollContainerContents({
    kind: 'quest-chest',
    tables: [lootTableOf(input.tableId)],
    seed: input.seed,
    sourceId: input.seed,
    targetKey: coordinateKey(input.chestHex),
    origin: input.origin ?? DEFAULT_TOKEN_ORIGIN,
  });
  return drops ?? [];
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

const CHEST_SPACE = questChestSpace({
  neighbours: questLootNeighbours,
  generate: ({ source, tableId }) =>
    generateChestDrop({
      seed: source.seed,
      chestHex: source.chest!.hex,
      tableId,
      origin: questTokenOrigin(source),
    }),
  seen: seenAround,
});

export function seekerOpenChest(
  progress: ProgressState,
  source: QuestRun,
  board: SeekerBoard,
  context: QuestChestContext,
): SeekerResult {
  const opening: QuestChestOpening = {
    progress,
    source,
    board,
    inventory: context.inventory,
    tableId: context.tableId,
    result: null,
  };
  const draft: IInventoryDraft = { current: context.inventory!, events: [] };
  const target = source.chest?.hex ?? positionOf(source);
  const opened = openInSpace(CHEST_SPACE, opening, progress.knowledge.heroId, target, draft);
  if (!opened.ok)
    return { ok: false, reason: opened.reason as SeekerRefusal, events: opened.events };
  return {
    ok: true,
    progress,
    run: opening.result!,
    events: [...opened.events, ...draft.events],
    ...(source.chest!.kind === 'real' ? { inventory: draft.current } : {}),
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
