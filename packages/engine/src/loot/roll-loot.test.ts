import { describe, expect, it } from 'vitest';
import { lootStreamLabel, rollLoot } from './roll-loot';
import { deriveStream } from '../utils/random-seeded';
import { BOSS_TABLE, CHEST_TABLE, COINS, SCROLL, SKIP_TABLE, streamFor } from './loot-test-setup';

describe('rollLoot', () => {
  it('REQ-LOOT-006 lists guaranteed drops first in table order, then the rolled ones', () => {
    for (let index = 0; index < 50; index += 1) {
      const drops = rollLoot(BOSS_TABLE, streamFor(`seed-${index}`));
      expect(drops[0]).toMatchObject({ itemKey: COINS, guaranteed: true });
      expect(drops[1]).toMatchObject({ itemKey: SCROLL, guaranteed: true });
      expect(drops.slice(2).every((drop) => !drop.guaranteed)).toBe(true);
      expect(drops.length).toBeGreaterThanOrEqual(5);
      expect(drops.length).toBeLessThanOrEqual(6);
    }
  });

  it('REQ-LOOT-007 gives the same list for the same seed and a fresh generator', () => {
    const first = rollLoot(CHEST_TABLE, streamFor('same'));
    const second = rollLoot(CHEST_TABLE, streamFor('same'));
    expect(second).toEqual(first);
  });

  it('REQ-LOOT-008 a table that rolls zero times drops nothing', () => {
    expect(rollLoot(SKIP_TABLE, streamFor('none'))).toEqual([]);
  });

  it('REQ-LOOT-021 the stream label carries the map or battle id and the target id', () => {
    expect(lootStreamLabel('map-1', 'chest:3:2')).not.toBe(lootStreamLabel('map-2', 'chest:3:2'));
    expect(lootStreamLabel('map-1', 'chest:3:2')).not.toBe(lootStreamLabel('map-1', 'chest:4:2'));
    const first = deriveStream('seed', lootStreamLabel('map-1', 'chest:3:2'));
    const otherMap = deriveStream('seed', lootStreamLabel('map-2', 'chest:3:2'));
    const otherTarget = deriveStream('seed', lootStreamLabel('map-1', 'chest:4:2'));
    const [a, b, c] = [first(), otherMap(), otherTarget()];
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('REQ-LOOT-021 different maps give different lists for some seeds', () => {
    let differing = 0;
    for (let index = 0; index < 100; index += 1) {
      const here = rollLoot(CHEST_TABLE, streamFor(`s${index}`, 'map-1'));
      const there = rollLoot(CHEST_TABLE, streamFor(`s${index}`, 'map-2'));
      if (JSON.stringify(here) !== JSON.stringify(there)) differing += 1;
    }
    expect(differing).toBeGreaterThan(50);
  });
});
