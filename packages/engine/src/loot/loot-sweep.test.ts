import { describe, expect, it } from 'vitest';
import { rollLoot } from './roll-loot';
import { placeLoot } from './place-loot';
import {
  FIXTURE_TABLES,
  ENERGY,
  POTION,
  SCREEN_RING,
  TARGET,
  WEIGHT_TABLE,
  hexAt,
  streamFor,
  type ScreenDirection,
} from './loot-test-setup';

const SEEDS = 1000;
const DIRECTIONS = Object.keys(SCREEN_RING) as ScreenDirection[];

describe('loot seed sweep', () => {
  it.each(FIXTURE_TABLES)('REQ-LOOT-023 invariants hold over 1000 seeds of $id', (table) => {
    const keys = new Set([
      ...table.entries.map((entry) => entry.itemKey),
      ...(table.guaranteed ?? []).map((entry) => entry.itemKey),
    ]);
    for (let index = 0; index < SEEDS; index += 1) {
      const drops = rollLoot(table, streamFor(`sweep-${index}`));
      const guaranteedCount = table.guaranteed?.length ?? 0;
      expect(drops.length).toBeGreaterThanOrEqual(table.rolls[0] + guaranteedCount);
      expect(drops.length).toBeLessThanOrEqual(table.rolls[1] + guaranteedCount);
      for (const drop of drops) {
        expect(keys.has(drop.itemKey)).toBe(true);
        const sources = [...(table.guaranteed ?? []), ...table.entries].filter(
          (entry) => entry.itemKey === drop.itemKey,
        );
        const min = Math.min(...sources.map((entry) => entry.amount[0]));
        const max = Math.max(...sources.map((entry) => entry.amount[1]));
        expect(drop.amount).toBeGreaterThanOrEqual(min);
        expect(drop.amount).toBeLessThanOrEqual(max);
      }

      const entryDirection = DIRECTIONS[index % DIRECTIONS.length];
      const mask = (index * 37) % 64;
      const neighbours = DIRECTIONS.map((direction, position) => ({
        hex: hexAt(direction),
        free: (mask >> position) % 2 === 1,
      }));
      const entry = hexAt(entryDirection);
      const result = placeLoot({ target: TARGET, entry, neighbours, drops: [drops] });
      if (result.kind !== 'placed') continue;
      const hexes = result.placements.map((placement) => `${placement.hex.q},${placement.hex.r}`);
      const free = new Set(
        neighbours
          .filter((item) => item.free && `${item.hex.q},${item.hex.r}` !== `${entry.q},${entry.r}`)
          .map((item) => `${item.hex.q},${item.hex.r}`),
      );
      expect(new Set(hexes).size).toBe(hexes.length);
      expect(hexes).not.toContain(`${entry.q},${entry.r}`);
      expect(hexes).not.toContain(`${TARGET.q},${TARGET.r}`);
      expect(hexes.every((hex) => free.has(hex))).toBe(true);
      expect(result.placements.length).toBeLessThanOrEqual(free.size);
    }
  });

  it('REQ-LOOT-024 a heavier entry appears more often than a lighter one', () => {
    const counts = new Map<string, number>();
    for (let index = 0; index < SEEDS; index += 1) {
      for (const drop of rollLoot(WEIGHT_TABLE, streamFor(`weights-${index}`))) {
        counts.set(drop.itemKey, (counts.get(drop.itemKey) ?? 0) + 1);
      }
    }
    expect(counts.get(POTION) ?? 0).toBeGreaterThan(counts.get(ENERGY) ?? 0);
    expect(counts.get(ENERGY) ?? 0).toBeGreaterThan(0);
  });
});
