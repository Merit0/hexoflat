import { describe, expect, it } from 'vitest';
import HexMapModel, { type ISerializedHexMap } from '../map/models/hex-map-model';
import { findShortestPath } from '../hero-movement/pathfinding-service';
import {
  BOARD_ATLAS,
  atlasNeighbour,
  arrivalSideFor,
  expectedExitSides,
} from '../content/boards/atlas';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { SILESIA_NORTH_BOARD } from '../content/boards/static/silesia-north';
import { SILESIA_NORTH_RECIPE, SILESIA_RECIPE } from '../content/boards/recipes';
import type { StaticBoardDrawing } from '../content/boards/schemas';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { buildStaticBoard } from './build-static-board';
import { classifyExits } from './exits';
import { parseBoardRows } from './board-rows';
import { findFreeHexNear, findFreeHexNearExit } from '../map/free-hex-finder';
import { runBoardPipeline } from './pipeline/run-board-pipeline';

function drawing(rows: string[]): StaticBoardDrawing {
  return { id: 'exit-probe', background: '', legend: {}, rows };
}

describe('exit sides', () => {
  it('classifyExits names the side of the shape an arrow sits nearest to', () => {
    const grid = parseBoardRows([
      '~ ~ > ~ ~',
      ' ~ . . . ~',
      '> . . . >',
      ' ~ . . . ~',
      '~ ~ > ~ ~',
    ]);
    const sides = [...classifyExits(grid).entries()].sort();

    expect(sides).toEqual([
      ['0:2', 'W'],
      ['2:0', 'N'],
      ['2:4', 'S'],
      ['4:2', 'E'],
    ]);
  });

  it('an arrow in a corner of the shape resolves deterministically, north before west', () => {
    expect(classifyExits(parseBoardRows(['> . .', ' . . .', '. . .'])).get('0:0')).toBe('N');
  });

  it('a board without arrows has no exits', () => {
    expect(classifyExits(parseBoardRows(['. . .'])).size).toBe(0);
  });
});

describe('exit tiles', () => {
  const plain = drawing(['. > .', ' . . .', '. . .']);

  it('buildStaticBoard marks exit tiles as passable ground carrying their side', () => {
    const { map } = buildStaticBoard(plain);
    const exit = map.tiles.find((tile) => tile.exit);

    expect(exit?.exit).toBe('N');
    expect(exit?.terrain).toBe('ground');
    expect(exit?.hexobject).toBeNull();
  });

  it('GATES:exits in the pipeline gives the same board as buildStaticBoard', () => {
    for (const board of [SILESIA_BOARD, SILESIA_NORTH_BOARD]) {
      const recipe = board === SILESIA_BOARD ? SILESIA_RECIPE : SILESIA_NORTH_RECIPE;
      expect(runBoardPipeline(recipe, { seed: '' }).map.toJSON()).toEqual(
        buildStaticBoard(board).map.toJSON(),
      );
    }
  });

  it('exit sides survive toJSON/fromJSON and tiles without an exit stay clean', () => {
    const { map } = buildStaticBoard(plain);
    const json = JSON.parse(JSON.stringify(map.toJSON())) as ISerializedHexMap;
    const restored = HexMapModel.fromJSON(json, 0);

    expect(restored.tiles.filter((tile) => tile.exit).map((tile) => tile.exit)).toEqual(['N']);
    expect(json.tiles.filter((tile) => 'exit' in tile)).toHaveLength(1);
  });
});

describe('atlas', () => {
  it('atlasNeighbour finds the board on each side, north being y - 1', () => {
    expect(atlasNeighbour('silesia', 'N')).toBe('silesia-north');
    expect(atlasNeighbour('silesia-north', 'S')).toBe('silesia');
    expect(atlasNeighbour('silesia', 'E')).toBeNull();
    expect(atlasNeighbour('nowhere', 'N')).toBeNull();
  });

  it('expectedExitSides lists the sides that have a neighbour; arrival is the opposite side', () => {
    expect(expectedExitSides('silesia')).toEqual(['N']);
    expect(expectedExitSides('silesia-north')).toEqual(['S']);
    expect(arrivalSideFor('N')).toBe('S');
    expect(Object.keys(BOARD_ATLAS)).toContain('silesia');
  });

  it('every exit of a real board can be walked to from the rest of the board', () => {
    for (const board of [SILESIA_BOARD, SILESIA_NORTH_BOARD]) {
      const { map } = buildStaticBoard(board);
      for (const tile of map.tiles) tile.isRevealed = true;
      const exit = map.tiles.find((tile) => tile.exit)!;
      const anchor = map.tiles.find(
        (tile) => !tile.exit && !tile.hexobject && tile.terrain === 'ground',
      )!;
      const camp = map.tiles.find(
        (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CAMPING_ENTRANCE,
      );

      expect(findShortestPath(map, anchor.coordinates, exit.coordinates), board.id).not.toBeNull();
      if (camp) {
        const neighbour = map.tiles.find(
          (tile) =>
            !tile.hexobject &&
            Math.abs(tile.coordinates.columnIndex - camp.coordinates.columnIndex) <= 1 &&
            Math.abs(tile.coordinates.rowIndex - camp.coordinates.rowIndex) <= 1 &&
            tile.terrain === 'ground',
        )!;
        expect(findShortestPath(map, neighbour.coordinates, exit.coordinates)).not.toBeNull();
      }
    }
  });
});

describe('placing a hero by an exit', () => {
  const board = buildStaticBoard(drawing(['~ > ~ ~', ' ~ = . ~', '~ . . > ~', ' ~ . . . ~'])).map;

  it('findFreeHexNearExit stands next to the exit on the requested side, never on water', () => {
    const north = findFreeHexNearExit(board, 'N');
    const tile = board.tiles.find(
      (candidate) =>
        candidate.coordinates.columnIndex === north?.columnIndex &&
        candidate.coordinates.rowIndex === north?.rowIndex,
    );

    expect(north).not.toBeNull();
    expect(tile?.terrain).toBe('ground');
  });

  it('findFreeHexNearExit returns null when the board has no exit on that side', () => {
    expect(findFreeHexNearExit(board, 'W')).toBeNull();
    expect(findFreeHexNearExit(buildStaticBoard(drawing(['. .'])).map)).toBeNull();
  });

  it('findFreeHexNear skips water and mountain neighbours', () => {
    const map = buildStaticBoard(drawing(['= . ^'])).map;
    const spot = findFreeHexNear(map, { columnIndex: 1, rowIndex: 0 });
    expect(spot).toBeNull();
  });
});
