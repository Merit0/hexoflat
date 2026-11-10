import { describe, expect, it } from 'vitest';
import { getPrototype } from '../content/content-accessors';
import type HexMapModel from '../map/models/hex-map-model';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import { CAMP_FACILITY_KEYS, installCampFacilities } from './camp-facilities';
import { createServerWorld, deserializeWorld, serializeWorld } from './server-world';

const STALL_HEX = { columnIndex: 10, rowIndex: 9 };
const GROUNDS_HEX = { columnIndex: 10, rowIndex: 5 };

function campBeforeTheShop() {
  const world = createServerWorld('camping', 'camp-map', 'seed', 'hero-1');
  for (const tile of world.map.tiles) {
    if (CAMP_FACILITY_KEYS.includes(tile.hexobject?.hexobjectKey as THexobjectKey)) {
      tile.hexobject = null;
    }
  }
  return world;
}

function keyAt(map: HexMapModel, hex: { columnIndex: number; rowIndex: number }) {
  return map.tiles.find((tile) => coordinateKey(tile.coordinates) === coordinateKey(hex))?.hexobject
    ?.hexobjectKey;
}

function countOf(map: HexMapModel, key: THexobjectKey) {
  return map.tiles.filter((tile) => tile.hexobject?.hexobjectKey === key).length;
}

describe('installCampFacilities', () => {
  it('places the stall and Training Grounds on their drawn hexes in a camp saved before them', () => {
    const { map } = campBeforeTheShop();
    expect(installCampFacilities(map, null)).toEqual([STALL_HEX, GROUNDS_HEX]);
    expect(keyAt(map, STALL_HEX)).toBe(HEXOBJECT_KEYS.TRADER_STALL);
    expect(keyAt(map, GROUNDS_HEX)).toBe(HEXOBJECT_KEYS.TRAINING_GROUNDS);
  });

  it('places the same object a freshly built camp has', () => {
    const fresh = createServerWorld('camping', 'fresh', 'seed', 'hero-1').map;
    const { map } = campBeforeTheShop();
    installCampFacilities(map, null);
    for (const hex of [STALL_HEX, GROUNDS_HEX]) {
      const installed = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(hex));
      const built = fresh.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(hex));
      expect(installed?.hexobject).toEqual(built?.hexobject);
    }
  });

  it('does nothing in a camp that already has them', () => {
    const { map } = createServerWorld('camping', 'camp-map', 'seed', 'hero-1');
    expect(installCampFacilities(map, null)).toEqual([]);
    expect(countOf(map, HEXOBJECT_KEYS.TRADER_STALL)).toBe(1);
    expect(countOf(map, HEXOBJECT_KEYS.TRAINING_GROUNDS)).toBe(1);
  });

  it('never builds on the hero', () => {
    const { map } = campBeforeTheShop();
    expect(installCampFacilities(map, STALL_HEX)).toEqual([GROUNDS_HEX]);
    expect(keyAt(map, STALL_HEX)).toBeUndefined();
    expect(installCampFacilities(map, null)).toEqual([STALL_HEX]);
  });

  it('never replaces what stands on the drawn hex', () => {
    const { map } = campBeforeTheShop();
    const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(STALL_HEX));
    if (!tile) throw new Error('no stall hex');
    tile.hexobject = { ...getPrototype(HEXOBJECT_KEYS.CHEST), id: 'someone-elses-chest' };
    installCampFacilities(map, null);
    expect(tile.hexobject.id).toBe('someone-elses-chest');
    expect(countOf(map, HEXOBJECT_KEYS.TRADER_STALL)).toBe(0);
  });
});

describe('deserializeWorld and the camp facilities', () => {
  it('gives a stored camp the stall and Training Grounds, keeping the hero where he stood', () => {
    const old = campBeforeTheShop();
    old.heroCoordinates = { columnIndex: 9, rowIndex: 9 };
    const loaded = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(old))), 0);
    expect(keyAt(loaded.map, STALL_HEX)).toBe(HEXOBJECT_KEYS.TRADER_STALL);
    expect(keyAt(loaded.map, GROUNDS_HEX)).toBe(HEXOBJECT_KEYS.TRAINING_GROUNDS);
    expect(loaded.heroCoordinates).toEqual({ columnIndex: 9, rowIndex: 9 });
    expect(loaded.mapId).toBe('camp-map');
  });

  it('leaves the hero standing on a drawn hex alone until he steps off', () => {
    const old = campBeforeTheShop();
    old.heroCoordinates = { ...GROUNDS_HEX };
    const loaded = deserializeWorld(serializeWorld(old), 0);
    expect(keyAt(loaded.map, GROUNDS_HEX)).toBeUndefined();
    expect(keyAt(loaded.map, STALL_HEX)).toBe(HEXOBJECT_KEYS.TRADER_STALL);
  });

  it('touches no other location', () => {
    const silesia = createServerWorld('silesia', 'silesia-map', 'seed', 'hero-1');
    const loaded = deserializeWorld(serializeWorld(silesia), 0);
    expect(countOf(loaded.map, HEXOBJECT_KEYS.TRADER_STALL)).toBe(0);
    expect(countOf(loaded.map, HEXOBJECT_KEYS.TRAINING_GROUNDS)).toBe(0);
  });
});
