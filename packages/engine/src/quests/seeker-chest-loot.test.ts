import { describe, expect, it } from 'vitest';
import { LOOT_TABLES } from '../content/loot-tables.content';
import { emptyInventoryState } from '../inventory/inventory-state';
import { lootStreamLabel, planLootSpread, rollLoot } from '../loot';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { axialToOffset, coordinateKey, getHexNeighbors, offsetToAxial } from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';
import { fullBag } from '../trade/trade-test-setup';
import { projectQuestForClient } from './projection';
import { inventoryWith } from './quest-test-setup';
import { floorKeys, positionOf } from './quest-state';
import { enterQuest, seekerReturn, seekerStep } from './seeker-actions';
import {
  questLootNeighbours,
  seekerCollectStep,
  seekerOpenChest,
  seekerPickup,
} from './seeker-chest';
import { lootTableMaxSellValue, SEEKER_CARDS } from './seeker-content';
import { SEEKER_CATALOGUE } from './seeker-quests';
import { followTruth, must, openChestOf, seekerProgress, startQuest } from './seeker-test-setup';
import { createTreasureField } from './treasure-field';

const TABLE_OF = Object.fromEntries(
  SEEKER_CARDS.map((card) => [card.id, card.params.chestLootTableId]),
);

function atChest(seed: string, id = 'seeker-1') {
  const state = startQuest(id, seed);
  return { state, end: followTruth(state, SEEKER_CARDS.find((c) => c.id === id)!.params.steps) };
}

function fieldRun(id: string, seed: string) {
  const field = createTreasureField(seed);
  const entered = must(
    enterQuest(seekerProgress(id), {
      questId: id,
      catalogue: SEEKER_CATALOGUE,
      seed,
      board: field,
      start: field.start,
      atBoard: true,
      hasRun: false,
    }),
  );
  const steps = SEEKER_CARDS.find((card) => card.id === id)!.params.steps;
  const start = { progress: entered.progress, run: entered.run, board: field };
  return { start, end: followTruth(start, steps) };
}

const keyOf = (item: { hex: { columnIndex: number; rowIndex: number } }) => coordinateKey(item.hex);

describe('REQ-QST-023 the real chest spreads loot by the shared rule', () => {
  it('places exactly what planLootSpread says for the same seed and leaves E and the chest empty', () => {
    for (const id of ['seeker-1', 'seeker-2', 'seeker-3']) {
      const { state, end } = atChest(`rule-${id}`, id);
      const chest = end.run.chest!.hex;
      const entry = positionOf(end.run);
      const inventory = inventoryWith({});
      const opened = must(openChestOf(state, end, inventory, TABLE_OF[id]));

      const target = offsetToAxial(chest);
      const floor = floorKeys(state.board);
      const drops = rollLoot(
        LOOT_TABLES[TABLE_OF[id]],
        deriveStream(end.run.seed, lootStreamLabel(end.run.seed, coordinateKey(chest))),
      );
      const expected = planLootSpread({
        target,
        entry: offsetToAxial(entry),
        neighbours: getHexNeighbors(chest)
          .filter((hex) => floor.has(coordinateKey(hex)))
          .map((hex) => ({
            hex: offsetToAxial(hex),
            free: coordinateKey(hex) !== coordinateKey(entry),
          })),
        lists: [drops],
        bag: { current: inventory, events: [] },
      });
      expect(expected.ok).toBe(true);
      if (!expected.ok) continue;
      expect(opened.run.collect!.ground).toEqual(
        expected.plan.placements.map(({ hex, itemKey, amount }) => ({
          hex: axialToOffset(hex),
          itemKey,
          amount,
        })),
      );
      const grounds = opened.run.collect!.ground.map(keyOf);
      expect(grounds).not.toContain(coordinateKey(chest));
      expect(grounds).not.toContain(coordinateKey(entry));
      expect(opened.run.collect!.hero).toEqual(chest);
      expect(opened.events[0].type).toBe('CONTAINER_OPENED');
      expect(opened.progress).toEqual(end.progress);
    }
  });

  it('a step back onto the emptied chest is refused, a step onto a loot hex too', () => {
    const { state, end } = atChest('rule-steps');
    const opened = must(openChestOf(state, end));
    const run = opened.run;
    const chest = end.run.chest!.hex;
    const entry = end.run.path[end.run.path.length - 1].hex;
    const stepped = must(seekerCollectStep(opened.progress, run, entry, state.board));
    expect(stepped.progress).toEqual(opened.progress);
    expect(positionOf(stepped.run)).toEqual(entry);
    expect(seekerCollectStep(stepped.progress, stepped.run, chest, state.board)).toMatchObject({
      reason: 'HEX_BLOCKED',
    });
    const lootHex = run.collect!.ground[0].hex;
    const elsewhere = structuredClone(run);
    elsewhere.collect!.hero = entry;
    const neighbour = getHexNeighbors(lootHex).find(
      (hex) =>
        coordinateKey(hex) !== coordinateKey(chest) &&
        floorKeys(state.board).has(coordinateKey(hex)),
    )!;
    elsewhere.collect!.hero = neighbour;
    expect(seekerCollectStep(opened.progress, elsewhere, lootHex, state.board)).toMatchObject({
      reason: 'HEX_BLOCKED',
    });
  });
});

describe('REQ-QST-026 every refusal leaves the state as it was', () => {
  it('refuses with the reason and changes nothing', () => {
    const { state, end } = atChest('refuse-a');
    const inventory = inventoryWith({ 0: [HEXOBJECT_KEYS.SWORD, 1] });
    const before = JSON.stringify([end.progress, end.run, inventory]);
    const cases: [string, ReturnType<typeof openChestOf>][] = [];

    const noChest = structuredClone(end.run);
    noChest.chest = null;
    cases.push([
      'CONTAINER_EMPTY',
      openChestOf(state, { progress: end.progress, run: noChest }, inventory),
    ]);
    const far = structuredClone(end.run);
    far.chest = { ...far.chest!, hex: state.run.start };
    cases.push([
      'NOT_ADJACENT',
      openChestOf(state, { progress: end.progress, run: far }, inventory),
    ]);
    const ended = structuredClone(end.run);
    ended.phase = 'ended';
    cases.push([
      'WRONG_PHASE',
      openChestOf(state, { progress: end.progress, run: ended }, inventory),
    ]);
    for (const [reason, result] of cases) {
      expect(result, reason).toMatchObject({ ok: false, reason });
    }
    const noBag = seekerOpenChest(end.progress, end.run, state.board, {
      inventory: undefined,
      tableId: 'seeker-1-chest-loot',
    });
    expect(noBag).toMatchObject({ ok: false, reason: 'NO_INVENTORY' });
    expect(JSON.stringify([end.progress, end.run, inventory])).toBe(before);

    const opened = must(openChestOf(state, end, inventory));
    const onChest = openChestOf(state, { progress: opened.progress, run: opened.run }, inventory);
    expect(onChest).toMatchObject({ ok: false, reason: 'STANDING_ON_TARGET' });
    const away = must(
      seekerCollectStep(
        opened.progress,
        opened.run,
        end.run.path[end.run.path.length - 1].hex,
        state.board,
      ),
    );
    expect(openChestOf(state, { progress: away.progress, run: away.run }, inventory)).toMatchObject(
      {
        ok: false,
        reason: 'CONTAINER_EMPTY',
      },
    );
  });
});

describe('REQ-QST-027 the loot is a function of the quest seed', () => {
  it('the same seed gives the same loot and another run gives another stream', () => {
    const a = atChest('stream-a', 'seeker-3');
    const again = atChest('stream-a', 'seeker-3');
    const open = (x: ReturnType<typeof atChest>) =>
      must(openChestOf(x.state, x.end, inventoryWith({}), TABLE_OF['seeker-3'])).run.collect!
        .ground;
    expect(open(a)).toEqual(open(again));
    const seen = new Set<string>();
    for (let i = 0; i < 12; i += 1)
      seen.add(JSON.stringify(open(atChest(`stream-${i}`, 'seeker-3'))));
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe('REQ-QST-028 a chest with no free place', () => {
  function crowded(tableId: string, inventory = inventoryWith({})) {
    const { state, end } = atChest('crowded');
    const entry = positionOf(end.run);
    const board = { ...state.board, floor: [entry, end.run.chest!.hex] };
    return { board, end, run: end.run, inventory, tableId, state };
  }

  const open = (c: ReturnType<typeof crowded>) =>
    seekerOpenChest(c.end.progress, c.run, c.board, {
      inventory: c.inventory,
      tableId: c.tableId,
    });

  it('sends the guaranteed drops to the bag', () => {
    const c = crowded('seeker-3-chest-loot');
    const result = must(open(c));
    expect(result.run.collect!.ground).toEqual([]);
    const kept = result.inventory!.bag.flatMap((item) => (item ? [item.key] : [])).sort();
    expect(kept).toEqual(
      [
        HEXOBJECT_KEYS.SWORD,
        HEXOBJECT_KEYS.SHIELD,
        HEXOBJECT_KEYS.HEALTH_BOTTLE,
        HEXOBJECT_KEYS.MANA_BOTTLE,
      ].sort(),
    );
    expect(result.events.some((event) => event.type === 'ITEM_GRANTED')).toBe(true);
  });

  it('answers BAG_FULL with a full bag, and the same list once there is space', () => {
    const full = crowded('seeker-3-chest-loot', fullBag());
    expect(open(full)).toMatchObject({ ok: false, reason: 'BAG_FULL' });
    const first = must(open(crowded('seeker-3-chest-loot')));
    const second = must(open(crowded('seeker-3-chest-loot')));
    expect(first.events[0]).toEqual(second.events[0]);
  });

  it('answers NO_ROOM_FOR_LOOT when nothing is guaranteed (a chest from before the stored drop)', () => {
    const c = crowded('cave-chest-loot');
    c.run = { ...c.run, chest: { ...c.run.chest!, drop: undefined, container: undefined } };
    expect(open(c)).toMatchObject({
      ok: false,
      reason: 'NO_ROOM_FOR_LOOT',
    });
  });
});

describe('REQ-QST-029 picking loot up', () => {
  it('takes a whole adjacent stack for free, leaves it when the bag is full, refuses a far one', () => {
    const { state, end } = atChest('pick-a', 'seeker-3');
    const opened = must(openChestOf(state, end, inventoryWith({}), TABLE_OF['seeker-3']));
    const [item] = opened.run.collect!.ground;
    const taken = must(seekerPickup(opened.progress, opened.run, item.hex, opened.inventory));
    expect(taken.progress).toEqual(opened.progress);
    expect(taken.run.collect!.ground.map(keyOf)).not.toContain(keyOf(item));
    const held = taken.inventory!.bag.reduce(
      (sum, cell) => (cell?.key === item.itemKey ? sum + cell.amount : sum),
      0,
    );
    expect(held).toBeGreaterThanOrEqual(item.amount);
    expect(taken.events.map((event) => event.type)).toContain('QUEST_LOOT_TAKEN');

    const full = fullBag();
    full.capacityKg = 1000;
    const blocked = seekerPickup(opened.progress, opened.run, item.hex, full);
    expect(blocked).toMatchObject({ ok: false, reason: 'BAG_FULL' });
    expect(opened.run.collect!.ground.map(keyOf)).toContain(keyOf(item));

    const far = structuredClone(opened.run);
    far.collect!.hero = state.run.start;
    expect(seekerPickup(opened.progress, far, item.hex, opened.inventory)).toMatchObject({
      reason: 'NOT_ADJACENT',
    });
    const emptyHex = getHexNeighbors(end.run.chest!.hex).find(
      (hex) =>
        floorKeys(state.board).has(coordinateKey(hex)) &&
        !opened.run.collect!.ground.some((ground) => keyOf(ground) === coordinateKey(hex)),
    )!;
    expect(seekerPickup(opened.progress, opened.run, emptyHex, opened.inventory)).toMatchObject({
      reason: 'NO_LOOT_THERE',
    });
    expect(seekerPickup(end.progress, end.run, item.hex, opened.inventory)).toMatchObject({
      reason: 'WRONG_PHASE',
    });
  });
});

describe('REQ-QST-030 returning with loot on the ground', () => {
  it('loses what is left, keeps the bag, counts the milestone and opens the next card', () => {
    const { state, end } = atChest('ret-a', 'seeker-1');
    const opened = must(openChestOf(state, end, inventoryWith({})));
    expect(opened.run.collect!.ground.length).toBeGreaterThan(0);
    const [item] = opened.run.collect!.ground;
    const taken = must(seekerPickup(opened.progress, opened.run, item.hex, opened.inventory));
    const left = must(seekerReturn(taken.progress, taken.run));
    expect(left.run.phase).toBe('ended');
    expect(left.progress.quests.done['seeker-1']).toBe(1);
    expect(left.progress.quests.active).toEqual([]);
    expect(taken.inventory!.bag.some((cell) => cell?.key === item.itemKey)).toBe(true);
  });
});

describe('REQ-QST-031 the chest always has room on real fields', () => {
  for (const card of SEEKER_CARDS) {
    it(`${card.id}: 500 seeds, at least 3 free neighbours, nothing on the chest, E or off the field`, () => {
      for (let i = 0; i < 500; i += 1) {
        const { start, end } = fieldRun(card.id, `sweep-${card.id}-${i}`);
        const run = end.run;
        expect(run.chest?.kind, `seed ${i}`).toBe('real');
        const target = offsetToAxial(run.chest!.hex);
        const free = questLootNeighbours(run, start.board, target).filter((n) => n.free);
        expect(free.length, `seed ${i}`).toBeGreaterThanOrEqual(3);
        const opened = must(
          openChestOf(start, end, emptyInventoryState('hero-1'), card.params.chestLootTableId),
        );
        const floor = floorKeys(start.board);
        const entry = coordinateKey(positionOf(run));
        for (const item of opened.run.collect!.ground) {
          expect(floor.has(keyOf(item))).toBe(true);
          expect(keyOf(item)).not.toBe(entry);
          expect(keyOf(item)).not.toBe(coordinateKey(run.chest!.hex));
        }
      }
    });
  }
});

describe('REQ-QST-032 nothing tells a real chest from a lure before OPEN', () => {
  it('projects the same shape and never names the kind or the table', () => {
    const { end } = atChest('proj-a');
    const real = JSON.stringify(projectQuestForClient(end.run));
    const lure = structuredClone(end.run);
    lure.chest = { ...lure.chest!, kind: 'lure' };
    expect(JSON.stringify(projectQuestForClient(lure))).toBe(real);
    expect(real).not.toMatch(/lure|real|loot|table|seed|trail/i);
  });
});

describe('REQ-QST-022 the chest of each card stays inside the card limit', () => {
  for (const card of SEEKER_CARDS) {
    it(`${card.id}: 10000 rolls never sell for more than ${card.maxSellValue}`, () => {
      const table = LOOT_TABLES[card.params.chestLootTableId];
      expect(lootTableMaxSellValue(table)).toBeLessThanOrEqual(card.maxSellValue);
      let best = 0;
      for (let i = 0; i < 10000; i += 1) {
        const drops = rollLoot(table, deriveStream(`eco-${card.id}-${i}`, 'roll'));
        const value = drops.reduce(
          (sum, drop) =>
            sum +
            (drop.itemKey === HEXOBJECT_KEYS.COINS
              ? drop.amount
              : lootTableMaxSellValue({
                  ...table,
                  rolls: [1, 1],
                  guaranteed: [],
                  entries: [
                    { itemKey: drop.itemKey, weight: 1, amount: [drop.amount, drop.amount] },
                  ],
                })),
          0,
        );
        best = Math.max(best, value);
      }
      expect(best).toBeLessThanOrEqual(card.maxSellValue);
      expect(best).toBeGreaterThan(0);
    });
  }
});

describe('REQ-QST-033 free steps in the collect phase', () => {
  it('walk without Will and never touch the Will meter', () => {
    const { state, end } = atChest('free-a');
    const opened = must(openChestOf(state, end));
    const entry = end.run.path[end.run.path.length - 1].hex;
    const moved = must(seekerStep(opened.progress, opened.run, entry, state.board));
    expect(moved.progress.knowledge.current).toBe(end.progress.knowledge.current);
    expect(moved.run.collect!.seen.length).toBeGreaterThan(opened.run.collect!.seen.length - 1);
    expect(moved.run.path).toEqual(end.run.path);
    expect(seekerStep(opened.progress, opened.run, state.run.start, state.board)).toMatchObject({
      reason: 'NOT_ADJACENT',
    });
  });
});
