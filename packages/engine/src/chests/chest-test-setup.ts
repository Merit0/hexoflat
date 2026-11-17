import { openInSpace } from '../containers';
import { emptyProgressState } from '../aggregates/progress-state';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { worldChestSpace } from './world-container-space';
import type { ChestWorld } from './open-chest';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { emptyInventoryState, type InventoryState } from '../inventory/inventory-state';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { HexTileModel } from '../map/models/hex-tile-model';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import {
  createServerWorld,
  serializeWorld,
  type ServerWorld,
  type WorldOutcome,
  type WorldRun,
} from '../world';

export const HERO = 'hero-1';

export function tileOf(world: ServerWorld, at: IHexCoordinates): HexTileModel {
  const tile = world.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(at));
  if (!tile) throw new Error(`no tile at ${coordinateKey(at)}`);
  return tile;
}

export function runOf(world: ServerWorld, overrides: Partial<WorldRun> = {}): WorldRun {
  return {
    world,
    progress: emptyProgressState(HERO),
    inventory: emptyInventoryState(HERO),
    heroId: HERO,
    now: 1_000,
    ...overrides,
  };
}

export function snapshotOf(world: ServerWorld): string {
  const json = serializeWorld(world);
  return JSON.stringify({
    ...json,
    map: { ...json.map, tiles: json.map.tiles.map((tile) => ({ ...tile, imagePath: '' })) },
  });
}

export function putObject(
  world: ServerWorld,
  at: IHexCoordinates,
  key: THexobjectKey,
  overrides?: Record<string, unknown>,
): HexTileModel {
  const tile = tileOf(world, at);
  tile.hexobject = HexObjectFactory.create(key, at, overrides);
  tile.isRevealed = true;
  return tile;
}

export function freeNeighbour(world: ServerWorld, around: IHexCoordinates, skip = 0) {
  const spots = getHexNeighbors(around).filter((coord) => {
    const tile = world.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(coord));
    return !!tile && !tile.hexobject && tile.terrain === 'ground';
  });
  const spot = spots[skip];
  if (!spot) throw new Error('no free neighbour');
  return spot;
}

export interface ChestScene {
  world: ServerWorld;
  chest: IHexCoordinates;
  entry: IHexCoordinates;
}

export function chestScene(seed = 'chest-seed'): ChestScene {
  const world = createServerWorld('cave', 'map-chest', seed, HERO);
  const entry = { ...world.heroCoordinates! };
  const chest = freeNeighbour(world, entry);
  putObject(world, chest, HEXOBJECT_KEYS.CHEST);
  return { world, chest, entry };
}

export function openAction(at: IHexCoordinates) {
  return {
    heroId: HERO,
    coordinates: at,
    actionType: EHexActionType.OPEN,
    toolKey: HEXOBJECT_KEYS.HAND,
    now: 1_000,
  };
}

export function bagOf(inventory: InventoryState) {
  return inventory.bag.filter((cell) => cell !== null);
}

export function afterOutcome(
  outcome: Extract<WorldOutcome, { ok: true }>,
  overrides: Partial<WorldRun> = {},
) {
  return runOf(outcome.world, {
    progress: structuredClone(outcome.progress),
    inventory: outcome.inventory,
    ...overrides,
  });
}

export function blockAround(
  world: ServerWorld,
  chest: IHexCoordinates,
  entry: IHexCoordinates,
  leaveFree = 0,
) {
  const spots = getHexNeighbors(chest).filter(
    (coord) => coordinateKey(coord) !== coordinateKey(entry),
  );
  const free: IHexCoordinates[] = [];
  for (const coord of spots) {
    const tile = world.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(coord));
    if (!tile) continue;
    if (free.length < leaveFree && !tile.hexobject && tile.terrain === 'ground') {
      free.push(coord);
      continue;
    }
    if (!tile.hexobject) putObject(world, coord, HEXOBJECT_KEYS.STONE_WALL);
  }
  return free;
}

export function itemsAround(world: ServerWorld, chest: IHexCoordinates) {
  return getHexNeighbors(chest).flatMap((coord) => {
    const tile = world.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(coord));
    const object = tile?.hexobject;
    return object &&
      object.groupType !== EHexobjectGroup.CONSTRUCTION &&
      object.groupType !== EHexobjectGroup.CREATURE
      ? [{ coordinates: coord, key: object.hexobjectKey, quantity: object.quantity ?? 1 }]
      : [];
  });
}

export function openRefusal(world: ChestWorld, tile: HexTileModel, heroId: string): string | null {
  const opened = openInSpace(
    worldChestSpace(EHexActionType.OPEN),
    world,
    heroId,
    tile.coordinates,
    { current: emptyInventoryState(heroId), events: [] },
  );
  return opened.ok ? null : opened.reason;
}
