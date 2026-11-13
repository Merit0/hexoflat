import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { Axial } from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';
import type { LootDrop, LootTable } from './loot-table';
import { lootStreamLabel } from './roll-loot';
import type { LootNeighbour } from './place-loot';

export const TARGET: Axial = { q: 3, r: 2 };

export const SCREEN_RING = {
  E: { q: 1, r: 0 },
  SE: { q: 0, r: 1 },
  SW: { q: -1, r: 1 },
  W: { q: -1, r: 0 },
  NW: { q: 0, r: -1 },
  NE: { q: 1, r: -1 },
} as const;
export type ScreenDirection = keyof typeof SCREEN_RING;

export const SCREEN_CLOCKWISE_AFTER: Record<ScreenDirection, ScreenDirection[]> = {
  E: ['SE', 'SW', 'W', 'NW', 'NE'],
  SE: ['SW', 'W', 'NW', 'NE', 'E'],
  SW: ['W', 'NW', 'NE', 'E', 'SE'],
  W: ['NW', 'NE', 'E', 'SE', 'SW'],
  NW: ['NE', 'E', 'SE', 'SW', 'W'],
  NE: ['E', 'SE', 'SW', 'W', 'NW'],
};

export function hexAt(direction: ScreenDirection): Axial {
  return { q: TARGET.q + SCREEN_RING[direction].q, r: TARGET.r + SCREEN_RING[direction].r };
}

export function neighboursWith(free: Partial<Record<ScreenDirection, boolean>>): LootNeighbour[] {
  return (Object.keys(free) as ScreenDirection[]).map((direction) => ({
    hex: hexAt(direction),
    free: free[direction] === true,
  }));
}

export function allFreeExcept(...blocked: ScreenDirection[]): LootNeighbour[] {
  return (Object.keys(SCREEN_RING) as ScreenDirection[]).map((direction) => ({
    hex: hexAt(direction),
    free: !blocked.includes(direction),
  }));
}

export function drop(itemKey: LootDrop['itemKey'], amount: number, guaranteed = false): LootDrop {
  return { itemKey, amount, guaranteed };
}

export const COINS = HEXOBJECT_KEYS.COINS;
export const POTION = HEXOBJECT_KEYS.HEALTH_BOTTLE;
export const CHARM = HEXOBJECT_KEYS.BONE_CHARM;
export const SHARD = HEXOBJECT_KEYS.CROWN_SHARD;
export const SCROLL = HEXOBJECT_KEYS.RETURN_SCROLL;
export const SWORD = HEXOBJECT_KEYS.SWORD;

export const CHEST_TABLE: LootTable = {
  id: 'fixture-chest',
  rolls: [2, 4],
  entries: [
    { itemKey: COINS, weight: 5, amount: [3, 9] },
    { itemKey: POTION, weight: 3, amount: [1, 2] },
    { itemKey: CHARM, weight: 1, amount: [1, 1] },
  ],
};

export const BOSS_TABLE: LootTable = {
  id: 'fixture-boss',
  rolls: [3, 4],
  guaranteed: [
    { itemKey: COINS, amount: [10, 20] },
    { itemKey: SHARD, amount: [1, 1] },
  ],
  entries: [
    { itemKey: SWORD, weight: 1, amount: [1, 1] },
    { itemKey: SCROLL, weight: 2, amount: [1, 2] },
    { itemKey: COINS, weight: 4, amount: [2, 5] },
  ],
};

export const SKIP_TABLE: LootTable = {
  id: 'fixture-none',
  rolls: [0, 0],
  entries: [],
};

export const WEIGHT_TABLE: LootTable = {
  id: 'fixture-weights',
  rolls: [1, 1],
  entries: [
    { itemKey: POTION, weight: 9, amount: [1, 1] },
    { itemKey: CHARM, weight: 1, amount: [1, 1] },
  ],
};

export const FIXTURE_TABLES = [CHEST_TABLE, BOSS_TABLE, WEIGHT_TABLE];

export function streamFor(seed: string, mapId = 'map-1', targetKey = 'chest:3:2') {
  return deriveStream(seed, lootStreamLabel(mapId, targetKey));
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}
