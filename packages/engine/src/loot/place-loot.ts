import { AXIAL_DIRS, type Axial } from '../utils/hex-utils';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { lootRefusal, type LootRefusal } from './loot-refusal';
import type { LootDrop } from './loot-table';

export interface LootNeighbour {
  hex: Axial;
  free: boolean;
}

export interface PlaceLootInput {
  target: Axial;
  entry: Axial;
  neighbours: readonly LootNeighbour[];
  drops: readonly (readonly LootDrop[])[];
}

export interface LootPlacement {
  hex: Axial;
  itemKey: LootDrop['itemKey'];
  amount: number;
  guaranteed: boolean;
}

export type PlaceLootResult =
  | { kind: 'placed'; placements: LootPlacement[]; toBag: LootDrop[] }
  | { kind: 'refused'; refusal: LootRefusal };

const DIRECTION_COUNT = AXIAL_DIRS.length;

function hexKey(hex: Axial): string {
  return `${hex.q},${hex.r}`;
}

function directionIndexOf(target: Axial, hex: Axial): number {
  return AXIAL_DIRS.findIndex((dir) => target.q + dir.q === hex.q && target.r + dir.r === hex.r);
}

function screenClockwiseFrom(entryIndex: number): number[] {
  return Array.from({ length: DIRECTION_COUNT - 1 }, (_, step) => {
    return (entryIndex - 1 - step + DIRECTION_COUNT * 2) % DIRECTION_COUNT;
  });
}

function freePlaces(input: PlaceLootInput): Axial[] {
  const entryIndex = directionIndexOf(input.target, input.entry);
  if (entryIndex < 0) throw new RangeError('loot entry hex must neighbour the target');
  const free = new Set<string>();
  for (const neighbour of input.neighbours) {
    if (directionIndexOf(input.target, neighbour.hex) < 0) {
      throw new RangeError('loot neighbours must all touch the target');
    }
    if (neighbour.free) free.add(hexKey(neighbour.hex));
  }
  return screenClockwiseFrom(entryIndex)
    .map((index) => ({
      q: input.target.q + AXIAL_DIRS[index].q,
      r: input.target.r + AXIAL_DIRS[index].r,
    }))
    .filter((hex) => free.has(hexKey(hex)));
}

function mergeCoins(drops: readonly LootDrop[]): LootDrop[] {
  const merged: LootDrop[] = [];
  let coins: LootDrop | null = null;
  for (const drop of drops) {
    if (drop.itemKey !== HEXOBJECT_KEYS.COINS) {
      merged.push({ ...drop });
    } else if (coins) {
      coins.amount += drop.amount;
      coins.guaranteed = coins.guaranteed || drop.guaranteed;
    } else {
      coins = { ...drop };
      merged.push(coins);
    }
  }
  return merged;
}

function split(
  drops: readonly LootDrop[],
  places: number,
): { placed: LootDrop[]; toBag: LootDrop[] } {
  let guaranteedLeft = Math.min(places, drops.filter((drop) => drop.guaranteed).length);
  let rolledLeft = places - guaranteedLeft;
  const placed: LootDrop[] = [];
  const toBag: LootDrop[] = [];
  for (const drop of drops) {
    if (drop.guaranteed) {
      if (guaranteedLeft > 0) {
        guaranteedLeft -= 1;
        placed.push(drop);
      } else {
        toBag.push(drop);
      }
    } else if (rolledLeft > 0) {
      rolledLeft -= 1;
      placed.push(drop);
    }
  }
  return { placed, toBag };
}

export function placeLoot(input: PlaceLootInput): PlaceLootResult {
  const places = freePlaces(input);
  const { placed, toBag } = split(mergeCoins(input.drops.flat()), places.length);
  if (places.length === 0 && toBag.length === 0) {
    return { kind: 'refused', refusal: lootRefusal('NO_ROOM_FOR_LOOT') };
  }
  const placements = placed.map((drop, index) => ({
    hex: { ...places[index] },
    itemKey: drop.itemKey,
    amount: drop.amount,
    guaranteed: drop.guaranteed,
  }));
  return { kind: 'placed', placements, toBag };
}
