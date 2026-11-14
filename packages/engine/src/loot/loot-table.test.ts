import { describe, expect, it } from 'vitest';
import { lootTableSchema } from './loot-table';
import { BOSS_TABLE, CHEST_TABLE, COINS, POTION } from './loot-test-setup';

const valid = { id: 't', rolls: [1, 2], entries: [{ itemKey: COINS, weight: 1, amount: [1, 3] }] };

describe('loot table schema', () => {
  it('REQ-LOOT-001 rejects rolls with min above max', () => {
    expect(lootTableSchema.safeParse({ ...valid, rolls: [3, 1] }).success).toBe(false);
  });

  it('REQ-LOOT-002 rejects zero and negative weights', () => {
    for (const weight of [0, -1]) {
      const entries = [{ itemKey: COINS, weight, amount: [1, 3] }];
      expect(lootTableSchema.safeParse({ ...valid, entries }).success).toBe(false);
    }
  });

  it('REQ-LOOT-003 rejects empty entries when rolls can be above zero', () => {
    expect(lootTableSchema.safeParse({ ...valid, entries: [] }).success).toBe(false);
    expect(lootTableSchema.safeParse({ ...valid, rolls: [0, 0], entries: [] }).success).toBe(true);
  });

  it('REQ-LOOT-004 rejects amounts below one and ranges that run backwards', () => {
    for (const amount of [
      [0, 2],
      [4, 2],
    ]) {
      const entries = [{ itemKey: COINS, weight: 1, amount }];
      expect(lootTableSchema.safeParse({ ...valid, entries }).success).toBe(false);
    }
    const guaranteed = [{ itemKey: POTION, amount: [0, 1] }];
    expect(lootTableSchema.safeParse({ ...valid, guaranteed }).success).toBe(false);
  });

  it('REQ-LOOT-005 round-trips a valid table, with and without guaranteed entries', () => {
    for (const table of [CHEST_TABLE, BOSS_TABLE]) {
      const parsed = lootTableSchema.parse(JSON.parse(JSON.stringify(table)));
      expect(parsed).toEqual(table);
    }
  });
});
