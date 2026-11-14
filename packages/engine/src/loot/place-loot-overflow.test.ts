import { describe, expect, it } from 'vitest';
import { emptyInventoryState } from '../inventory/inventory-state';
import { fullBag } from '../trade/trade-test-setup';
import { planLootSpread } from './plan-spread';
import { placeLoot } from './place-loot';
import { rollLoot } from './roll-loot';
import {
  CHARM,
  COINS,
  POTION,
  SHARD,
  BOSS_TABLE,
  SWORD,
  TARGET,
  streamFor,
  allFreeExcept,
  drop,
  hexAt,
} from './loot-test-setup';

const THREE_PLACES = allFreeExcept('E', 'SW', 'W');
const FOUR_GUARANTEED = [
  drop(SWORD, 1, true),
  drop(SHARD, 1, true),
  drop(POTION, 1, true),
  drop(CHARM, 1, true),
];

function place(neighbours = THREE_PLACES, drops = FOUR_GUARANTEED) {
  return placeLoot({ target: TARGET, entry: hexAt('E'), neighbours, drops: [drops] });
}

describe('placeLoot characterization: truncation with guaranteed drops (before LOOT-OVF)', () => {
  it('REQ-LOOT-109 3 places, 4 guaranteed: three are placed, the fourth goes to the bag, none is lost', () => {
    const result = place();
    expect(result.kind).toBe('placed');
    if (result.kind !== 'placed') return;
    expect(result.placements.map((entry) => entry.itemKey)).toEqual([SWORD, SHARD, POTION]);
    expect(result.toBag).toEqual([drop(CHARM, 1, true)]);
  });

  it('REQ-LOOT-110 3 places, 2 guaranteed + 3 rolled: 2 guaranteed and 1 rolled placed, 2 rolled discarded', () => {
    const result = place(THREE_PLACES, [
      drop(SWORD, 1, true),
      drop(SHARD, 1, true),
      drop(COINS, 4),
      drop(POTION, 1),
      drop(CHARM, 1),
    ]);
    expect(result.kind).toBe('placed');
    if (result.kind !== 'placed') return;
    expect(result.placements.map((entry) => entry.itemKey)).toEqual([SWORD, SHARD, COINS]);
    expect(result.toBag).toEqual([]);
  });

  it('REQ-LOOT-111 0 places, guaranteed present: they all go to the bag and rolled ones are gone', () => {
    const none = allFreeExcept('E', 'SE', 'SW', 'W', 'NW', 'NE');
    const result = place(none, [...FOUR_GUARANTEED, drop(COINS, 3)]);
    expect(result).toEqual({ kind: 'placed', placements: [], toBag: FOUR_GUARANTEED });
  });
});

function spread(bag: ReturnType<typeof emptyInventoryState>, drops = FOUR_GUARANTEED) {
  return planLootSpread({
    target: TARGET,
    entry: hexAt('E'),
    neighbours: THREE_PLACES,
    lists: [drops],
    bag: { current: bag, events: [] },
  });
}

describe('REQ-LOOT-112 an overflow is checked against the whole bag list', () => {
  it('a full bag refuses with BAG_FULL, changes nothing and gives the same list once room appears', () => {
    const full = fullBag();
    const before = JSON.stringify(full);
    expect(spread(full)).toEqual({ ok: false, reason: 'BAG_FULL' });
    expect(JSON.stringify(full)).toBe(before);
    const first = spread(emptyInventoryState('hero-1'));
    const second = spread(emptyInventoryState('hero-1'));
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true });
    if (!first.ok) return;
    expect(first.plan.placements).toHaveLength(3);
    expect(first.plan.toBag).toEqual([{ itemKey: CHARM, amount: 1 }]);
  });
});

describe('REQ-LOOT-113 no guaranteed drop is lost over 1000 seeds', () => {
  it('placements plus toBag always hold every guaranteed drop rolled', () => {
    for (let index = 0; index < 1000; index += 1) {
      const rolled = rollLoot(BOSS_TABLE, streamFor(`ovf-${index}`));
      const guaranteed = rolled.filter((entry) => entry.guaranteed);
      const places = index % 7;
      const neighbours = allFreeExcept('E').map((n, at) => ({ ...n, free: at < places }));
      const result = placeLoot({
        target: TARGET,
        entry: hexAt('E'),
        neighbours,
        drops: [rolled],
      });
      if (result.kind === 'refused') {
        expect(guaranteed, `seed ${index}`).toEqual([]);
        continue;
      }
      const kept = [...result.placements.filter((entry) => entry.guaranteed), ...result.toBag];
      for (const want of guaranteed) {
        const got = kept.filter((entry) => entry.itemKey === want.itemKey);
        const total = got.reduce((sum, entry) => sum + entry.amount, 0);
        expect(total, `seed ${index} ${want.itemKey}`).toBeGreaterThanOrEqual(want.amount);
      }
    }
  });
});
