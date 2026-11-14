import { describe, expect, it } from 'vitest';
import { placeLoot, type LootPlacement, type PlaceLootInput } from './place-loot';
import {
  CHARM,
  COINS,
  POTION,
  SCREEN_CLOCKWISE_AFTER,
  SCREEN_RING,
  SCROLL,
  SHARD,
  SWORD,
  TARGET,
  allFreeExcept,
  deepFreeze,
  drop,
  hexAt,
  neighboursWith,
  type ScreenDirection,
} from './loot-test-setup';

function run(input: Partial<PlaceLootInput> & Pick<PlaceLootInput, 'drops'>) {
  return placeLoot({
    target: TARGET,
    entry: hexAt('E'),
    neighbours: allFreeExcept('E'),
    ...input,
  });
}

function placed(result: ReturnType<typeof placeLoot>): LootPlacement[] {
  if (result.kind !== 'placed') throw new Error(`expected placed, got ${result.kind}`);
  return result.placements;
}

function hexesOf(placements: LootPlacement[]) {
  return placements.map((placement) => placement.hex);
}

function expectNothingOnEntryOrTarget(result: ReturnType<typeof placeLoot>, entry = hexAt('E')) {
  if (result.kind !== 'placed') return;
  for (const placement of result.placements) {
    expect(placement.hex).not.toEqual(entry);
    expect(placement.hex).not.toEqual(TARGET);
  }
}

const THREE = [drop(COINS, 4), drop(POTION, 1), drop(CHARM, 1)];

describe('placeLoot', () => {
  it('REQ-LOOT-009 five free places, three drops: the first three hexes clockwise on screen after E', () => {
    const result = run({ drops: [THREE] });
    expect(hexesOf(placed(result))).toEqual([hexAt('SE'), hexAt('SW'), hexAt('W')]);
    expect(placed(result).map((entry) => entry.itemKey)).toEqual([COINS, POTION, CHARM]);
  });

  it('REQ-LOOT-010 five drops, two free places: two placed, the last three discarded', () => {
    const five = [
      drop(POTION, 1),
      drop(CHARM, 1),
      drop(SWORD, 1),
      drop(SCROLL, 1),
      drop(POTION, 2),
    ];
    const neighbours = allFreeExcept('E', 'SW', 'W', 'NW');
    const result = run({ drops: [five], neighbours });
    expect(placed(result).map((entry) => entry.itemKey)).toEqual([POTION, CHARM]);
    expect(hexesOf(placed(result))).toEqual([hexAt('SE'), hexAt('NE')]);
  });

  it('REQ-LOOT-011 the entry hex never receives a drop, even when it is flagged free', () => {
    const everyone = allFreeExcept();
    const many = Array.from({ length: 8 }, () => drop(POTION, 1));
    const result = run({ drops: [many], neighbours: everyone });
    expect(placed(result)).toHaveLength(5);
    expectNothingOnEntryOrTarget(result);
  });

  it('REQ-LOOT-012 zero free and nothing guaranteed: NO_ROOM_FOR_LOOT and the input is untouched', () => {
    const input = deepFreeze({
      target: TARGET,
      entry: hexAt('E'),
      neighbours: allFreeExcept('E', 'SE', 'SW', 'W', 'NW', 'NE'),
      drops: [THREE],
    });
    const before: unknown = JSON.parse(JSON.stringify(input));
    const result = placeLoot(input);
    expect(result).toEqual({ kind: 'refused', refusal: { ok: false, reason: 'NO_ROOM_FOR_LOOT' } });
    expect(JSON.parse(JSON.stringify(input))).toEqual(before);
  });

  it('REQ-LOOT-013 zero free with guaranteed drops: they go to the bag, rolled drops are absent', () => {
    const neighbours = allFreeExcept('E', 'SE', 'SW', 'W', 'NW', 'NE');
    const result = run({
      neighbours,
      drops: [[drop(SHARD, 1, true), drop(POTION, 1), drop(CHARM, 1)]],
    });
    expect(result).toEqual({ kind: 'to-bag', drops: [drop(SHARD, 1, true)] });
  });

  it('REQ-LOOT-014 zero free with two guaranteed entries: both go to the bag', () => {
    const neighbours = neighboursWith({ E: false, SE: false, SW: false });
    const result = run({
      neighbours,
      drops: [[drop(COINS, 12, true), drop(SHARD, 1, true), drop(POTION, 1)]],
    });
    expect(result).toEqual({
      kind: 'to-bag',
      drops: [drop(COINS, 12, true), drop(SHARD, 1, true)],
    });
  });
});

describe('placeLoot guaranteed and coins', () => {
  it('REQ-LOOT-015 guaranteed drops come first and survive truncation while any place exists', () => {
    const neighbours = allFreeExcept('E', 'SE', 'SW', 'W');
    const result = run({
      neighbours,
      drops: [[drop(COINS, 12, true), drop(SHARD, 1, true), drop(POTION, 1), drop(CHARM, 1)]],
    });
    expect(placed(result).map((entry) => entry.itemKey)).toEqual([COINS, SHARD]);
    const single = run({
      neighbours: neighboursWith({ NW: true }),
      drops: [[drop(COINS, 12, true), drop(SHARD, 1, true), drop(POTION, 1)]],
    });
    expect(placed(single).map((entry) => entry.itemKey)).toEqual([COINS]);
  });

  it('REQ-LOOT-016 several coin drops become one stack at the first coin position, merged before truncation', () => {
    const drops = [drop(POTION, 1), drop(COINS, 3), drop(CHARM, 1), drop(COINS, 4), drop(COINS, 5)];
    const result = run({
      drops: [drops],
      neighbours: neighboursWith({ SE: true, SW: true, W: true }),
    });
    expect(placed(result).map((entry) => [entry.itemKey, entry.amount])).toEqual([
      [POTION, 1],
      [COINS, 12],
      [CHARM, 1],
    ]);
  });

  it('REQ-LOOT-016 a merged stack is guaranteed when any part was', () => {
    const result = run({ drops: [[drop(COINS, 3), drop(COINS, 4, true)]] });
    expect(placed(result)).toMatchObject([{ itemKey: COINS, amount: 7, guaranteed: true }]);
  });

  it('REQ-LOOT-017 two drop lists are concatenated in order and coins merge across both', () => {
    const first = [drop(COINS, 2), drop(POTION, 1)];
    const second = [drop(CHARM, 1), drop(COINS, 5)];
    const result = run({ drops: [first, second] });
    expect(placed(result).map((entry) => [entry.itemKey, entry.amount])).toEqual([
      [COINS, 7],
      [POTION, 1],
      [CHARM, 1],
    ]);
  });
});

describe('placeLoot order and edges', () => {
  it('REQ-LOOT-018 an occupied neighbour is skipped and the order continues after it', () => {
    const result = run({ drops: [THREE], neighbours: allFreeExcept('E', 'SW') });
    expect(hexesOf(placed(result))).toEqual([hexAt('SE'), hexAt('W'), hexAt('NW')]);
  });

  const SIX: ScreenDirection[] = ['E', 'SE', 'SW', 'W', 'NW', 'NE'];
  it.each(SIX)('REQ-LOOT-019 entry on %s: the other five follow clockwise on screen', (entry) => {
    const five = Array.from({ length: 5 }, (_, index) => drop(POTION, index + 1));
    const result = run({
      entry: hexAt(entry),
      neighbours: allFreeExcept(entry),
      drops: [five],
    });
    expect(hexesOf(placed(result))).toEqual(SCREEN_CLOCKWISE_AFTER[entry].map(hexAt));
    expect(placed(result).map((item) => item.amount)).toEqual([1, 2, 3, 4, 5]);
    expectNothingOnEntryOrTarget(result, hexAt(entry));
  });

  it('REQ-LOOT-019 the hand-written ring really is clockwise on screen', () => {
    const angle = ({ q, r }: { q: number; r: number }) => {
      const raw = Math.atan2(1.5 * r, Math.sqrt(3) * (q + r / 2));
      return raw < 0 ? raw + 2 * Math.PI : raw;
    };
    const order = SIX.map((direction) => angle(SCREEN_RING[direction]));
    for (let index = 1; index < order.length; index += 1) {
      expect(order[index]).toBeGreaterThan(order[index - 1]);
    }
  });

  it('REQ-LOOT-020 a board edge with fewer than six neighbours supplied', () => {
    const neighbours = neighboursWith({ E: false, SE: true, W: true });
    const result = run({ neighbours, drops: [[drop(POTION, 1), drop(CHARM, 1), drop(SWORD, 1)]] });
    expect(hexesOf(placed(result))).toEqual([hexAt('SE'), hexAt('W')]);
    const none = run({ neighbours: [], drops: [THREE] });
    expect(none.kind).toBe('refused');
  });
});

describe('placeLoot purity', () => {
  it('REQ-LOOT-022 the same drops fit the same prefix whatever the number of free places', () => {
    const list = [
      drop(COINS, 3, true),
      drop(POTION, 1),
      drop(CHARM, 1),
      drop(SWORD, 1),
      drop(SCROLL, 1),
    ];
    const wide = placed(run({ drops: [list] })).map((entry) => entry.itemKey);
    const order: ScreenDirection[] = ['SE', 'SW', 'W', 'NW', 'NE'];
    for (let free = 1; free <= 5; free += 1) {
      const open = order.slice(0, free);
      const neighbours = neighboursWith({
        E: false,
        ...Object.fromEntries(order.map((direction) => [direction, open.includes(direction)])),
      });
      const result = placed(run({ drops: [list], neighbours })).map((entry) => entry.itemKey);
      expect(result).toEqual(wide.slice(0, free));
    }
  });

  it('REQ-LOOT-025 inputs are never mutated and equal inputs give deep-equal results', () => {
    const input = deepFreeze({
      target: TARGET,
      entry: hexAt('E'),
      neighbours: allFreeExcept('E', 'W'),
      drops: [[drop(COINS, 3), drop(COINS, 4), drop(POTION, 1)], [drop(CHARM, 1, true)]],
    });
    const first = placeLoot(input);
    const second = placeLoot(input);
    expect(second).toEqual(first);
    expect(input.drops[0][0]).toEqual(drop(COINS, 3));
  });

  it('REQ-LOOT-026 an entry hex that does not touch the target is a caller bug', () => {
    expect(() =>
      placeLoot({ target: TARGET, entry: { q: 9, r: 9 }, neighbours: [], drops: [THREE] }),
    ).toThrow(RangeError);
    expect(() =>
      placeLoot({
        target: TARGET,
        entry: hexAt('E'),
        neighbours: [{ hex: { q: 9, r: 9 }, free: true }],
        drops: [THREE],
      }),
    ).toThrow(RangeError);
  });
});
