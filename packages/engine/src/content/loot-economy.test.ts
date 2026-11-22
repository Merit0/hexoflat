import { beforeAll, describe, expect, it } from 'vitest';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { hexagonBoard } from '../battle/battle-test-setup';
import { RING_OF_TARGET, TARGET, king, lootAt, play, won } from '../battle/collect-test-setup';
import { lootTableSchema } from '../loot/loot-table';
import { placeLoot, rollLoot } from '../loot';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { discountedUnit } from '../trade/discount-math';
import { sellUnitPrice } from '../trade/trader-view';
import { deriveStream } from '../utils/random-seeded';
import { coinPriceOf } from './content-accessors';
import { CONTENT } from './content-map';
import {
  CAVE_CHEST_TABLE_ID,
  LOOT_ECONOMY_TARGET,
  LOOT_TABLES,
  SEEKER_CHEST_TABLE_IDS,
  SKELETON_KING_TABLE_ID,
  lootTableOf,
} from './loot-tables.content';
import {
  buildPools,
  simulateRun,
  summarise,
  type EconomyPools,
  type RunResult,
} from './loot-economy-setup';
import { TRADERS } from './traders.content';
import {
  bossTableProblems,
  lootContentFailures,
  lootContentProblems,
  lootReferenceProblems,
  lootTableProblems,
} from './validate-loot';

const RUNS = 10_000;
const ROLLS = 10_000;
const MAX_DISCOUNT = Math.max(...(TRADERS.ilva.discounts?.percents ?? [0]));
const ITEMS_IN_TABLES = [
  ...new Set(
    Object.values(LOOT_TABLES)
      .filter((table) => !SEEKER_CHEST_TABLE_IDS.includes(table.id))
      .flatMap((table) =>
        [...(table.guaranteed ?? []), ...table.entries].map((entry) => entry.itemKey),
      ),
  ),
];

describe('REQ-LOOT-103 loot content is validated at load', () => {
  it('parses every table and passes the real content check', () => {
    for (const table of Object.values(LOOT_TABLES)) {
      expect(() => lootTableSchema.parse(table), table.id).not.toThrow();
    }
    expect(lootContentFailures()).toEqual([]);
  });

  it('rejects a creature or a chest that names a table that does not exist', () => {
    const tables = { real: LOOT_TABLES[CAVE_CHEST_TABLE_ID] };
    expect(
      lootReferenceProblems(
        [
          { owner: 'creature:ghost', tableId: 'missing-table' },
          { owner: 'chest', tableId: undefined },
        ],
        tables,
      ),
    ).toEqual(['[creature:ghost] unknown loot table "missing-table"', '[chest] has no loot table']);
  });

  it('rejects an item key that does not exist', () => {
    const broken = {
      id: 'broken',
      rolls: [1, 1],
      entries: [{ itemKey: 'no-such-item', weight: 1, amount: [1, 1] }],
    };
    const problems = lootTableProblems({ broken }, coinPriceOf);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('[loot:broken]');
  });

  it('rejects a sellable loot item without a coinPrice, but never asks coins for one', () => {
    const table = {
      id: 'unpriced',
      rolls: [1, 1],
      entries: [
        { itemKey: HEXOBJECT_KEYS.COINS, weight: 1, amount: [1, 1] },
        { itemKey: HEXOBJECT_KEYS.CROWN_SHARD, weight: 1, amount: [1, 1] },
      ],
    };
    expect(lootTableProblems({ unpriced: table }, () => null)).toEqual([
      '[loot:unpriced] crown-shard is sellable loot without a coinPrice',
    ]);
  });

  it('rejects a boss whose table has no guaranteed entries', () => {
    expect(
      bossTableProblems(
        [
          { owner: 'boss:a', tableId: 'skeleton-warrior-loot' },
          { owner: 'boss:b', tableId: SKELETON_KING_TABLE_ID },
        ],
        LOOT_TABLES,
      ),
    ).toEqual(['[boss:a] a boss table needs guaranteed entries']);
    expect(
      lootContentProblems({
        tables: LOOT_TABLES,
        references: [],
        bosses: [{ owner: 'boss:b', tableId: SKELETON_KING_TABLE_ID }],
        priceOf: coinPriceOf,
      }),
    ).toEqual([]);
  });

  it('keeps every squad free of the removed loot field', () => {
    const squads = Object.values(CONTENT).flatMap((entry) =>
      entry.groupType === EHexobjectGroup.CREATURE && entry.creature.squad
        ? [entry.creature.squad]
        : [],
    );
    expect(squads.length).toBeGreaterThan(0);
    for (const squad of squads) expect(squad).not.toHaveProperty('loot');
  });
});

describe('REQ-LOOT-104 the tables hold what the plan says', () => {
  it('keeps energy and mana bottles out of every creature and cave chest table', () => {
    expect(ITEMS_IN_TABLES).not.toContain(HEXOBJECT_KEYS.ENERGY_BOTTLE);
    expect(ITEMS_IN_TABLES).not.toContain(HEXOBJECT_KEYS.MANA_BOTTLE);
  });

  it('never leaves the boss or the chest empty in 10 000 rolls', () => {
    const chest = lootTableOf(CAVE_CHEST_TABLE_ID)!;
    const boss = lootTableOf(SKELETON_KING_TABLE_ID)!;
    for (let i = 0; i < ROLLS; i += 1) {
      expect(rollLoot(chest, deriveStream(`never-empty-${i}`, 'chest')).length).toBeGreaterThan(0);
      expect(rollLoot(boss, deriveStream(`never-empty-${i}`, 'boss')).length).toBeGreaterThan(0);
    }
  });

  it('drops the boss coins and the crown shard in 10 000 of 10 000 rolls', () => {
    const boss = lootTableOf(SKELETON_KING_TABLE_ID)!;
    let withBoth = 0;
    for (let i = 0; i < ROLLS; i += 1) {
      const keys = rollLoot(boss, deriveStream(`boss-${i}`, 'boss')).map((drop) => drop.itemKey);
      if (keys.includes(HEXOBJECT_KEYS.COINS) && keys.includes(HEXOBJECT_KEYS.CROWN_SHARD)) {
        withBoth += 1;
      }
    }
    expect(withBoth).toBe(ROLLS);
  });

  it('sends the guaranteed boss drops to the bag when no place is free, with the real table', () => {
    const boss = lootTableOf(SKELETON_KING_TABLE_ID)!;
    const entry = { q: 0, r: 0 };
    const neighbours = [
      { q: 2, r: 0 },
      { q: 2, r: -1 },
      { q: 1, r: -1 },
      { q: 0, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ].map((hex) => ({ hex, free: false }));
    for (let i = 0; i < 200; i += 1) {
      const result = placeLoot({
        target: TARGET,
        entry,
        neighbours,
        drops: [rollLoot(boss, deriveStream(`boxed-${i}`, 'boss'))],
      });
      expect(result.kind).toBe('placed');
      if (result.kind !== 'placed') continue;
      expect(result.placements).toEqual([]);
      expect(result.toBag.map((drop) => drop.itemKey).sort()).toEqual(
        [HEXOBJECT_KEYS.COINS, HEXOBJECT_KEYS.CROWN_SHARD].sort(),
      );
    }
  });

  it('puts the boss guaranteed drops into the hero bag in a real boxed-in battle', () => {
    const state = won([king('k1', TARGET)], { board: hexagonBoard(3, RING_OF_TARGET) });
    const looted = play(state, lootAt(TARGET));
    expect(looted.refused).toBeNull();
    const carried = looted.inventory!.bag.flatMap((cell) => (cell ? [cell.key] : []));
    expect(carried).toContain(HEXOBJECT_KEYS.COINS);
    expect(carried).toContain(HEXOBJECT_KEYS.CROWN_SHARD);
    expect(looted.battle.collect!.items).toEqual([]);
  });
});

describe('REQ-LOOT-105 nothing earns coins by buying and selling', () => {
  const stocked = [...TRADERS.ilva.guaranteed, ...TRADERS.ilva.pool].map((good) => good.key);

  it.each(stocked)('%s: the trader pays no more than the lowest price he can sell it at', (key) => {
    const sell = sellUnitPrice(TRADERS.ilva, key)!;
    const price = coinPriceOf(key)!;
    const lowest = Math.min(
      price,
      ...(TRADERS.ilva.discounts?.percents ?? []).flatMap((percent) => {
        const unit = discountedUnit(key, percent);
        return unit === null ? [] : [unit];
      }),
    );
    expect(lowest).toBe(discountedUnit(key, MAX_DISCOUNT));
    expect(sell).toBeLessThanOrEqual(lowest);
  });

  it.each(ITEMS_IN_TABLES.filter((key) => key !== HEXOBJECT_KEYS.COINS))(
    '%s: loot never sells above its own shop price at the biggest discount',
    (key: THexobjectKey) => {
      const sell = sellUnitPrice(TRADERS.ilva, key)!;
      const buy = (coinPriceOf(key)! * (100 - MAX_DISCOUNT)) / 100;
      expect(sell).toBeLessThanOrEqual(buy);
    },
  );
});

describe('REQ-LOOT-106 ten thousand cave runs with the real tables and the real placement', () => {
  let pools: EconomyPools;
  let runs: RunResult[];

  beforeAll(() => {
    pools = buildPools();
    runs = Array.from({ length: RUNS }, (_, index) => simulateRun(pools, index));
  }, 300_000);

  it('builds real boards for every squad, the chest and the bot fights', () => {
    expect(pools.caves.length).toBeGreaterThanOrEqual(100);
    expect(pools.court.length).toBeGreaterThanOrEqual(50);
    expect(pools.pack.length).toBeGreaterThanOrEqual(50);
    expect(pools.lone.length).toBeGreaterThanOrEqual(40);
  });

  it('pays the target gear in two to three runs, within the tolerance', () => {
    const gear = coinPriceOf(LOOT_ECONOMY_TARGET.gearKey)!;
    const coins = summarise(runs.map((run) => run.coins));
    const sell = summarise(runs.map((run) => run.sellValue));
    const slack = 1 + LOOT_ECONOMY_TARGET.toleranceRatio;
    console.info(
      [
        `economy (${RUNS} runs, target ${LOOT_ECONOMY_TARGET.gearKey} ${gear} coins)`,
        `coins/run: mean ${coins.mean.toFixed(1)}, median ${coins.median}, p5 ${coins.p5}, p95 ${coins.p95}`,
        `sell value/run: mean ${sell.mean.toFixed(1)}, median ${sell.median}, p5 ${sell.p5}, p95 ${sell.p95}`,
        `runs to the gear (mean): ${(gear / sell.mean).toFixed(2)}, by median: ${(gear / sell.median).toFixed(2)}`,
      ].join('\n'),
    );
    expect(sell.mean).toBeGreaterThanOrEqual(gear / LOOT_ECONOMY_TARGET.runsMax / slack);
    expect(sell.mean).toBeLessThanOrEqual((gear / LOOT_ECONOMY_TARGET.runsMin) * slack);
    expect(coins.mean).toBeGreaterThan(0);
    expect(coins.p5).toBeLessThan(coins.median);
    expect(coins.p95).toBeGreaterThan(coins.median);
  });

  it('leaves about one ordinary grave in four empty', () => {
    const graves = runs.reduce((sum, run) => sum + run.ordinaryGraves, 0);
    const empty = runs.reduce((sum, run) => sum + run.emptyOrdinaryGraves, 0);
    const share = empty / graves;
    console.info(`empty ordinary graves: ${(share * 100).toFixed(1)}% of ${graves}`);
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.3);
  });

  it('loses only a small part of the drops to cramped surroundings', () => {
    const rolled = runs.reduce((sum, run) => sum + run.rolledDrops, 0);
    const lost = runs.reduce((sum, run) => sum + run.lostDrops, 0);
    console.info(`drops lost to cramped surroundings: ${((lost / rolled) * 100).toFixed(1)}%`);
    expect(lost / rolled).toBeGreaterThan(0.14);
    expect(lost / rolled).toBeLessThan(0.17);
  });
});

describe('REQ-LOOT-107 the simulation is deterministic', () => {
  it('gives the same numbers for the same seeds', () => {
    const sizes = { caves: 6, court: 4, pack: 4, lone: 4 };
    const first = buildPools(sizes);
    const second = buildPools(sizes);
    const a = Array.from({ length: 120 }, (_, index) => simulateRun(first, index));
    const b = Array.from({ length: 120 }, (_, index) => simulateRun(second, index));
    expect(b).toEqual(a);
    expect(summarise(b.map((run) => run.sellValue))).toEqual(
      summarise(a.map((run) => run.sellValue)),
    );
  });
});
