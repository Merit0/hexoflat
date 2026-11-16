import { describe, expect, it } from 'vitest';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS as K } from '../registry/hexobjects-registry';
import { EHexActionType as A } from '../enums/hex-action-type';
import { createServerWorld } from '../world/server-world';
import { getHexNeighbors } from '../utils/hex-utils';
import {
  TRANSITION_REFUSAL_MESSAGES,
  objectActionDestination,
  objectTransitionRefusal,
} from './object-transition';

describe('object action destinations', () => {
  it.each([
    [K.CAVE_ENTRANCE, A.ENTER, { type: 'WORLD', locationKey: 'cave' }],
    [K.CAMPING_ENTRANCE, A.ENTER, { type: 'WORLD', locationKey: 'camping' }],
    [K.TREASURE_MAP, A.OPEN, { type: 'QUEST', mapKey: 'treasure-seeker-map' }],
    [K.SKELETON_PACK, A.ATTACK, { type: 'BATTLE' }],
    [K.SKELETON_PACK, A.SCOUT, null],
    [K.TREASURE_MAP, A.ENTER, null],
  ] as const)('resolves %s / %s without changing its object category', (key, action, expected) => {
    const object = HexObjectFactory.create(key, { columnIndex: 0, rowIndex: 0 });
    expect(objectActionDestination(object, action)).toEqual(expected);
  });

  it('checks visibility, distance, battle and tool without mutating the map', () => {
    const world = createServerWorld('silesia', 'map', 'seed', 'hero');
    const tile = world.map.tiles[0];
    tile.hexobject = HexObjectFactory.create(K.TREASURE_MAP, tile.coordinates);
    tile.isRevealed = true;
    const hero = getHexNeighbors(tile.coordinates)[0];
    const check = (tool = K.HAND as typeof K.HAND | typeof K.SWORD) =>
      objectTransitionRefusal(tile, hero, false, A.OPEN, tool);
    expect(check()).toBeNull();
    expect(check(K.SWORD)).toBe('INVALID_ACTION');
    expect(objectTransitionRefusal(tile, hero, true, A.OPEN, K.HAND)).toBe('BATTLE_OPEN');
    expect(objectTransitionRefusal(tile, null, false, A.OPEN, K.HAND)).toBe('NO_POSITION');
    expect(objectTransitionRefusal(tile, tile.coordinates, false, A.OPEN, K.HAND)).toBe('TOO_FAR');
    tile.isRevealed = false;
    expect(check()).toBe('HIDDEN');
    expect(tile.hexobject.hexobjectKey).toBe(K.TREASURE_MAP);
  });

  it('words every refusal for the player instead of showing its code', () => {
    for (const [code, message] of Object.entries(TRANSITION_REFUSAL_MESSAGES)) {
      expect(message).not.toBe(code);
      expect(message).toMatch(/^[A-Z][a-z].*[.!]$/);
    }
  });
});
