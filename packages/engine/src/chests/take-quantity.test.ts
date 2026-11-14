import { describe, expect, it } from 'vitest';
import { EHexActionType } from '../enums/hex-action-type';
import { toAggregate } from '../inventory/inventory-adapter';
import { countItem } from '../inventory/plan-stock';
import { fullBag } from '../trade/trade-test-setup';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { actWorld, deserializeWorld, serializeWorld, tickWorld } from '../world';
import { createServerWorld } from '../world';
import { freeNeighbour, HERO, putObject, runOf, tileOf } from './chest-test-setup';

function sceneWith(key: THexobjectKey, quantity?: number) {
  const world = createServerWorld('camping', 'map-take', 'take-seed', HERO);
  const spot = freeNeighbour(world, world.heroCoordinates!);
  putObject(world, spot, key, quantity === undefined ? undefined : { quantity });
  return { world, spot };
}

function take(spot: { columnIndex: number; rowIndex: number }) {
  return {
    heroId: HERO,
    coordinates: spot,
    actionType: EHexActionType.TAKE,
    toolKey: HEXOBJECT_KEYS.HAND,
    now: 1_000,
  };
}

function takeAll(
  world: ReturnType<typeof sceneWith>['world'],
  spot: { columnIndex: number; rowIndex: number },
  inventory?: ReturnType<typeof runOf>['inventory'],
) {
  const started = actWorld(runOf(world, inventory ? { inventory } : {}), take(spot));
  if (!started.ok) throw new Error(started.code);
  const done = tickWorld({
    ...runOf(started.world, { now: 60_000 }),
    inventory: started.inventory,
    progress: started.progress,
  });
  if (!done.ok) throw new Error(done.code);
  return done;
}

describe('taking a stack from a hex', () => {
  it('REQ-LOOT-027: an item with no quantity still gives one piece (characterization)', () => {
    const { world, spot } = sceneWith(HEXOBJECT_KEYS.HEALTH_BOTTLE);
    const done = takeAll(world, spot);
    expect(countItem(toAggregate(done.inventory), HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(1);
  });

  it('REQ-LOOT-028: a stack of 7 coins goes into the bag whole and the item leaves the hex', () => {
    const { world, spot } = sceneWith(HEXOBJECT_KEYS.COINS, 7);
    const done = takeAll(world, spot);
    expect(countItem(toAggregate(done.inventory), HEXOBJECT_KEYS.COINS)).toBe(7);
    expect(tileOf(done.world, spot).hexobject).toBeNull();
  });

  it('REQ-LOOT-029: a stack that does not fit is refused as a whole and stays on the hex', () => {
    const { world, spot } = sceneWith(HEXOBJECT_KEYS.HEALTH_BOTTLE, 7);
    const full = fullBag(HEXOBJECT_KEYS.SWORD);
    const done = takeAll(world, spot, full);
    expect(countItem(toAggregate(done.inventory), HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(0);
    expect(done.inventory).toEqual(full);
    expect(tileOf(done.world, spot).hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.HEALTH_BOTTLE);
    expect(tileOf(done.world, spot).hexobject?.quantity).toBe(7);
  });

  it('REQ-LOOT-070: a refused pickup says BAG_FULL, a successful one says nothing', () => {
    const full = sceneWith(HEXOBJECT_KEYS.HEALTH_BOTTLE, 7);
    const refused = takeAll(full.world, full.spot, fullBag(HEXOBJECT_KEYS.SWORD));
    expect(refused.events).toContainEqual({
      type: 'LOOT_REJECTED',
      payload: { heroId: HERO, reason: 'BAG_FULL' },
    });
    const room = sceneWith(HEXOBJECT_KEYS.COINS, 7);
    expect(takeAll(room.world, room.spot).events.some((e) => e.type === 'LOOT_REJECTED')).toBe(
      false,
    );
  });

  it('REQ-LOOT-030: a quantity survives a save, an old item without one loads as a single piece', () => {
    const { world, spot } = sceneWith(HEXOBJECT_KEYS.COINS, 7);
    const back = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(world))), 0);
    expect(tileOf(back, spot).hexobject?.quantity).toBe(7);
    expect(tileOf(back, spot).hexobject).toEqual(tileOf(world, spot).hexobject);

    const old: unknown = JSON.parse(
      JSON.stringify(serializeWorld(sceneWith(HEXOBJECT_KEYS.COINS).world)),
    );
    const loaded = deserializeWorld(old, 0);
    const coinTile = loaded.map.tiles.find(
      (t) => t.hexobject?.hexobjectKey === HEXOBJECT_KEYS.COINS,
    )!;
    expect(coinTile.hexobject?.quantity).toBeUndefined();
    const done = takeAll(loaded, coinTile.coordinates);
    expect(countItem(toAggregate(done.inventory), HEXOBJECT_KEYS.COINS)).toBe(1);
  });
});
