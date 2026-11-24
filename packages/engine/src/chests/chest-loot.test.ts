import { locationDropContext } from '../registry/location-drop-context';
import { describe, expect, it } from 'vitest';
import { EHexActionType } from '../enums/hex-action-type';
import { toAggregate } from '../inventory/inventory-adapter';
import { countItem } from '../inventory/plan-stock';
import { placeLoot } from '../loot';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import {
  AXIAL_DIRS,
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  offsetToAxial,
} from '../utils/hex-utils';
import { isTerrainPassable } from '../boards/terrain';
import { actWorld, stepWorld, tickWorld, type WorldOutcome } from '../world';
import { rollChestLoot } from './plan-chest-loot';
import {
  afterOutcome,
  blockAround,
  chestScene,
  HERO,
  itemsAround,
  openAction,
  putObject,
  runOf,
  snapshotOf,
  tileOf,
} from './chest-test-setup';

function applied(outcome: WorldOutcome) {
  if (!outcome.ok) throw new Error(outcome.code);
  return outcome;
}

function expectedPlacements(scene: ReturnType<typeof chestScene>) {
  const { world, chest, entry } = scene;
  const drops = rollChestLoot(tileOf(world, chest), {
    seed: world.worldSeed,
    sourceId: world.mapId,
    dropContext: locationDropContext('cave'),
  });
  const target = offsetToAxial(chest);
  const neighbours = AXIAL_DIRS.flatMap((dir) => {
    const hex = { q: target.q + dir.q, r: target.r + dir.r };
    const tile = world.map.tiles.find(
      (t) => coordinateKey(t.coordinates) === coordinateKey(axialToOffset(hex)),
    );
    return tile ? [{ hex, free: isTerrainPassable(tile.terrain) && !tile.hexobject }] : [];
  });
  const result = placeLoot({ target, entry: offsetToAxial(entry), neighbours, drops: [drops] });
  return { drops, result };
}

function openedPayload(outcome: Extract<WorldOutcome, { ok: true }>) {
  const event = outcome.events.find((e) => e.type === 'CONTAINER_OPENED')!;
  return event.payload as {
    placed: { hex: { q: number; r: number }; itemKey: string; amount: number }[];
    toBag: unknown[];
  };
}

describe('loot from a chest', () => {
  it('REQ-LOOT-055: the placements are the L1 rule for the same seed, with quantities, one coin stack, E empty, the chest open', () => {
    const scene = chestScene();
    const { world, chest, entry } = scene;
    const expected = expectedPlacements(scene);
    expect(expected.result.kind).toBe('placed');
    const outcome = applied(actWorld(runOf(world), openAction(chest)));
    const payload = openedPayload(outcome);
    if (expected.result.kind !== 'placed') return;
    expect(payload.placed).toEqual(
      expected.result.placements.map((p) => ({
        hex: p.hex,
        itemKey: p.itemKey,
        amount: p.amount,
      })),
    );
    const onMap = itemsAround(outcome.world, chest);
    expect(onMap.map((i) => [i.key, i.quantity]).sort()).toEqual(
      payload.placed.map((p) => [p.itemKey, p.amount]).sort(),
    );
    expect(onMap.filter((i) => i.key === HEXOBJECT_KEYS.COINS).length).toBeLessThanOrEqual(1);
    expect(tileOf(outcome.world, entry).hexobject).toBeNull();
    expect(tileOf(outcome.world, chest).hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.CHEST_OPEN);
    expect(payload.toBag).toEqual([]);
  });

  it('REQ-LOOT-056: no free place refuses before the charge and the move, and a freed place gives the same list', () => {
    const scene = chestScene();
    const { world, chest, entry } = scene;
    const spot = getHexNeighbors(chest).find((c) => coordinateKey(c) !== coordinateKey(entry))!;
    blockAround(world, chest, entry, 0);
    const before = snapshotOf(world);
    const run = runOf(world);
    const refused = actWorld(run, openAction(chest));
    expect(refused).toMatchObject({ ok: false, code: 'ACTION_REJECTED' });
    expect(JSON.stringify(refused.ok ? [] : refused.events)).toContain('NO_ROOM_FOR_LOOT');
    expect(snapshotOf(world)).toBe(before);
    expect(run.progress.knowledge.current).toBe(50);
    expect(world.heroCoordinates).toEqual(entry);
    const rolled = rollChestLoot(tileOf(world, chest), {
      seed: world.worldSeed,
      sourceId: world.mapId,
      dropContext: locationDropContext('cave'),
    });

    const tile = tileOf(world, spot);
    if (tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.STONE_WALL) tile.hexobject = null;
    tile.terrain = 'ground';
    const after = expectedPlacements(scene);
    expect(after.drops).toEqual(rolled);
    const outcome = applied(actWorld(runOf(world), openAction(chest)));
    const payload = openedPayload(outcome);
    expect(payload.placed).toHaveLength(1);
    if (after.result.kind === 'placed') {
      expect(payload.placed[0].itemKey).toBe(after.result.placements[0].itemKey);
      expect(payload.placed[0].amount).toBe(after.result.placements[0].amount);
    }
  });

  it('REQ-LOOT-057: the same seed and chest roll the same loot, another map id another stream', () => {
    const { world, chest } = chestScene();
    const tile = tileOf(world, chest);
    const roll = (sourceId: string) =>
      JSON.stringify(
        rollChestLoot(tile, {
          seed: world.worldSeed,
          sourceId,
          dropContext: locationDropContext('cave'),
        }),
      );
    expect(roll('map-1')).toBe(roll('map-1'));
    const lists = new Set(Array.from({ length: 12 }, (_, i) => roll(`map-${i}`)));
    expect(lists.size).toBeGreaterThan(1);
  });

  it('REQ-LOOT-058: a neighbouring item, creature or object takes a place', () => {
    const scene = chestScene();
    const { world, chest, entry } = scene;
    const others = getHexNeighbors(chest).filter(
      (c) => coordinateKey(c) !== coordinateKey(entry) && tileOf(world, c).terrain === 'ground',
    );
    const open = expectedPlacements(scene);
    const total = open.result.kind === 'placed' ? open.result.placements.length : 0;
    expect(others.length).toBeGreaterThanOrEqual(3);
    putObject(world, others[0], HEXOBJECT_KEYS.HEALTH_BOTTLE);
    putObject(world, others[1], HEXOBJECT_KEYS.SKELETON_PACK);
    putObject(world, others[2], HEXOBJECT_KEYS.STONE_WALL);
    const freePlaces = getHexNeighbors(chest).filter((c) => {
      const t = tileOf(world, c);
      return (
        coordinateKey(c) !== coordinateKey(entry) && isTerrainPassable(t.terrain) && !t.hexobject
      );
    }).length;
    const expected = expectedPlacements(scene).result;
    const outcome = applied(actWorld(runOf(world), openAction(chest)));
    const placed = openedPayload(outcome).placed.length;
    expect(placed).toBeLessThanOrEqual(freePlaces);
    expect(placed).toBe(expected.kind === 'placed' ? expected.placements.length : -1);
    expect(placed).toBeLessThan(total + 1);
  });
});

describe('loot taken from a chest hex', () => {
  it('REQ-LOOT-059: from the chest hex a neighbouring stack is taken whole, and after everything is taken every neighbour is a way out', () => {
    const scene = chestScene();
    const { world, chest } = scene;
    const opened = applied(actWorld(runOf(world), openAction(chest)));
    const items = itemsAround(opened.world, chest);
    expect(items.length).toBeGreaterThan(0);
    let current = opened;
    let now = 2_000;
    for (const item of items) {
      const start = applied(
        actWorld(afterOutcome(current, { now }), {
          heroId: HERO,
          coordinates: item.coordinates,
          actionType: EHexActionType.TAKE,
          toolKey: HEXOBJECT_KEYS.HAND,
          now,
        }),
      );
      now += 10_000;
      current = applied(tickWorld(afterOutcome(start, { now })));
    }
    const coins = items.find((i) => i.key === HEXOBJECT_KEYS.COINS);
    if (coins) {
      expect(countItem(toAggregate(current.inventory), HEXOBJECT_KEYS.COINS)).toBe(coins.quantity);
    }
    expect(itemsAround(current.world, chest)).toEqual([]);
    const exits = getHexNeighbors(chest).filter((c) => {
      const t = tileOf(current.world, c);
      return isTerrainPassable(t.terrain) && !t.hexobject;
    });
    expect(exits.length).toBeGreaterThan(0);
    for (const exit of exits) {
      const stepped = stepWorld(afterOutcome(current), exit);
      expect(stepped).toMatchObject({ ok: true });
    }
  });

  it('REQ-LOOT-060: the opening event never carries a discarded drop or the table', () => {
    const scene = chestScene();
    const { world, chest, entry } = scene;
    blockAround(world, chest, entry, 1);
    const outcome = applied(actWorld(runOf(world), openAction(chest)));
    const payload = openedPayload(outcome);
    expect(payload.placed).toHaveLength(1);
    const text = JSON.stringify(outcome.events);
    expect(text).not.toContain('weight');
    expect(text).not.toContain('rolls');
    expect(text).not.toContain(world.worldSeed);
  });
});
