import { describe, expect, it } from 'vitest';
import { EHexobjectGroup } from '../../abstraction/hexobject-abstraction';
import { buildStaticBoard } from '../../boards/build-static-board';
import { EHexActionType } from '../../enums/hex-action-type';
import { resolveActions } from '../../game-resolvers/interactions-resolver';
import {
  buildTileIndex,
  getTraversableNeighbors,
  isTraversableTile,
} from '../../hero-movement/movement-grid';
import { CAMP_BOOK_HEX } from '../../knowledge/camp-book';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '../../utils/hex-utils';
import type { THeroToolKey } from '../equipment.content';
import { campObjectSpots, standsNextToCampObject } from './camp-object-spot';
import { CAMPING_BOARD } from './static/camping';

const STALL = HEXOBJECT_KEYS.TRADER_STALL;
const GROUNDS = HEXOBJECT_KEYS.TRAINING_GROUNDS;
const HERO_TOOLS: THeroToolKey[] = [
  HEXOBJECT_KEYS.HAND,
  HEXOBJECT_KEYS.AXE,
  HEXOBJECT_KEYS.PICKAXE,
  HEXOBJECT_KEYS.RETURN_SCROLL,
  HEXOBJECT_KEYS.COINS,
  HEXOBJECT_KEYS.SWORD,
  HEXOBJECT_KEYS.SHIELD,
];

function camp() {
  const { map } = buildStaticBoard(CAMPING_BOARD);
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

function tileOf(key: THexobjectKey) {
  const tile = camp().tiles.find((candidate) => candidate.hexobject?.hexobjectKey === key);
  if (!tile?.hexobject) throw new Error(`the camp drawing has no ${key}`);
  return { tile, hexobject: tile.hexobject };
}

describe('camp drawing: trader stall and Training Grounds', () => {
  it('puts the stall on r09 c10 and Training Grounds on r05 c10', () => {
    expect(campObjectSpots(STALL)).toEqual([{ columnIndex: 10, rowIndex: 9 }]);
    expect(campObjectSpots(GROUNDS)).toEqual([{ columnIndex: 10, rowIndex: 5 }]);
    expect(tileOf(STALL).tile.coordinates).toEqual({ columnIndex: 10, rowIndex: 9 });
    expect(tileOf(GROUNDS).tile.coordinates).toEqual({ columnIndex: 10, rowIndex: 5 });
  });

  it('keeps both inside the tree wall and off the Book of Will hex', () => {
    const map = camp();
    const existing = new Set(map.tiles.map((tile) => coordinateKey(tile.coordinates)));
    for (const key of [STALL, GROUNDS]) {
      const [spot] = campObjectSpots(key);
      expect(coordinateKey(spot)).not.toBe(coordinateKey(CAMP_BOOK_HEX));
      for (const hex of getHexNeighbors(spot)) expect(existing.has(coordinateKey(hex))).toBe(true);
    }
  });

  it('leaves every free camp hex reachable from the gate', () => {
    const map = camp();
    const index = buildTileIndex(map);
    const free = map.tiles.filter((tile) => isTraversableTile(tile));
    const gate = tileOf(HEXOBJECT_KEYS.HOMELAND_GATE).tile.coordinates;
    const start = getHexNeighbors(gate).find((hex) =>
      isTraversableTile(index.get(coordinateKey(hex))),
    );
    if (!start) throw new Error('nothing to stand on beside the gate');
    const seen = new Set([coordinateKey(start)]);
    const queue = [start];
    while (queue.length > 0) {
      const center = queue.shift()!;
      for (const next of getTraversableNeighbors(index, center)) {
        const key = coordinateKey(next.coordinates);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push(next.coordinates);
      }
    }
    const unreachable = free.filter((tile) => !seen.has(coordinateKey(tile.coordinates)));
    expect(unreachable.map((tile) => tile.coordinates)).toEqual([]);
  });

  it('lets the hero stand next to the stall on all six sides', () => {
    const [stall] = campObjectSpots(STALL);
    for (const hex of getHexNeighbors(stall)) {
      expect(standsNextToCampObject({ locationKey: 'camping', coordinates: hex }, STALL)).toBe(
        true,
      );
    }
    expect(standsNextToCampObject({ locationKey: 'camping', coordinates: stall }, STALL)).toBe(
      false,
    );
  });
});

describe('trader stall', () => {
  const { tile, hexobject } = tileOf(STALL);

  it('is solid', () => {
    expect(isTraversableTile(tile)).toBe(false);
  });

  it('offers OPEN to the hand only, for free', () => {
    expect(resolveActions(HEXOBJECT_KEYS.HAND, hexobject).map((a) => a.actioType)).toEqual([
      EHexActionType.OPEN,
    ]);
    for (const tool of HERO_TOOLS.filter((key) => key !== HEXOBJECT_KEYS.HAND)) {
      expect(resolveActions(tool, hexobject)).toEqual([]);
    }
    expect(CAMPING_BOARD.legend.S.hexobjectKey).toBe(STALL);
  });

  it('shows the shop sprite and is not locked', () => {
    expect(hexobject.spritePath).toBe('/hex-assets/hex-constructs/camping/shop-hex.png');
    expect(
      hexobject.groupType === EHexobjectGroup.CONSTRUCTION && hexobject.construction.isLocked,
    ).toBe(false);
  });
});

describe('Training Grounds', () => {
  const { tile, hexobject } = tileOf(GROUNDS);

  it('is solid, locked and not interactable', () => {
    expect(isTraversableTile(tile)).toBe(false);
    expect(hexobject.isInteractable).toBe(false);
    expect(
      hexobject.groupType === EHexobjectGroup.CONSTRUCTION && hexobject.construction.isLocked,
    ).toBe(true);
    expect(hexobject.spritePath).toBe(
      '/hex-assets/hex-constructs/camping/training-grounds-hex.png',
    );
  });

  it('offers no action to any tool', () => {
    for (const tool of HERO_TOOLS) expect(resolveActions(tool, hexobject)).toEqual([]);
  });
});
