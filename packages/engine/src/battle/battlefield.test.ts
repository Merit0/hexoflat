import { describe, expect, it } from 'vitest';
import { runBoardPipeline } from '../boards/pipeline/run-board-pipeline';
import { BATTLEFIELD_CRYPT_MODEL } from '../content/boards/models/battlefield-crypt';
import { battleDistance, hexNeighbours, hexKey, parseHexKey } from './hex-battle-geom';
import { battlefieldSeed, generateBattlefield, type Battlefield } from './battlefield';

function count(field: Battlefield, terrain: string): number {
  return Object.values(field.board).filter((t) => t === terrain).length;
}

const CENTRE = { q: 0, r: 0 };

function isBorder(key: string, terrain: string): boolean {
  return terrain === 'wall' && battleDistance(parseHexKey(key), CENTRE) >= 4;
}

function fieldHexes(field: Battlefield): string[] {
  return Object.entries(field.board)
    .filter(([key, t]) => !isBorder(key, t))
    .map(([key]) => key);
}

function walkableConnected(field: Battlefield): boolean {
  const blocked = new Set(field.boulders.map((b) => hexKey(b.pos)));
  const open = Object.entries(field.board)
    .filter(([key, t]) => t !== 'wall' && t !== 'saw' && !blocked.has(key))
    .map(([key]) => key);
  const openSet = new Set(open);
  const seen = new Set([open[0]]);
  const stack = [open[0]];
  while (stack.length) {
    for (const next of hexNeighbours(parseHexKey(stack.pop()!)).map(hexKey)) {
      if (openSet.has(next) && !seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen.size === open.length;
}

function hasPushCombo(field: Battlefield): boolean {
  return Object.entries(field.board)
    .filter(([, t]) => t === 'saw')
    .some(([key]) =>
      hexNeighbours(parseHexKey(key)).some((n) =>
        ['oil', 'ledge'].includes(field.board[hexKey(n)] ?? ''),
      ),
    );
}

describe('REQ-ENC-006 battlefield', () => {
  it('builds the same board from the same squad and attempt', () => {
    const seed = battlefieldSeed('enc-7', 0);
    expect(generateBattlefield('crypt', seed)).toEqual(generateBattlefield('crypt', seed));
    expect(generateBattlefield('crypt', battlefieldSeed('enc-7', 1))).not.toEqual(
      generateBattlefield('crypt', seed),
    );
  });

  it('uses only the approved hexes: floor, the border wall and one or two saws', () => {
    for (let n = 0; n < 200; n++) {
      const seed = battlefieldSeed(`enc-${n}`, 0);
      const pipeline = runBoardPipeline(BATTLEFIELD_CRYPT_MODEL, { seed });
      expect(pipeline.descriptor, seed).toMatchObject({ kind: 'RECIPE', seed });
      expect((pipeline.descriptor as { attempt: number }).attempt, seed).toBeLessThan(12);

      const field = generateBattlefield('crypt', seed);
      expect(count(field, 'saw'), seed).toBeGreaterThanOrEqual(1);
      expect(count(field, 'saw'), seed).toBeLessThanOrEqual(2);
      for (const terrain of ['ledge', 'rubble', 'oil'] as const) {
        expect(count(field, terrain), `${seed} ${terrain}`).toBe(0);
      }
      const pillars = Object.entries(field.board).filter(
        ([key, t]) => t === 'wall' && !isBorder(key, t),
      ).length;
      expect(pillars, seed).toBe(0);
      expect(field.boulders, seed).toEqual([]);
      expect(walkableConnected(field), seed).toBe(true);
    }
  });

  it('is a natural hexagon of radius 4 centred on 0,0', () => {
    const field = generateBattlefield('crypt', battlefieldSeed('enc-shape', 0));
    const hexes = fieldHexes(field).map(parseHexKey);
    expect(hexes.every((h) => battleDistance(h, CENTRE) <= 4)).toBe(true);
    expect(hexes.length).toBeLessThan(61);
    expect(hexes.length).toBeGreaterThanOrEqual(57);
    expect(field.board['0,0']).toBeDefined();
  });

  it('is enclosed by a stone border on every seed', () => {
    for (let n = 0; n < 50; n++) {
      const field = generateBattlefield('crypt', battlefieldSeed(`enc-${n}`, 0));
      const inner = fieldHexes(field).filter((key) => field.board[key] !== 'wall');
      for (const key of inner) {
        for (const next of hexNeighbours(parseHexKey(key)).map(hexKey)) {
          expect(field.board[next], `${n} ${key}→${next}`).toBeDefined();
        }
      }
      const border = Object.entries(field.board).filter(([key, t]) => isBorder(key, t));
      expect(border.length, String(n)).toBeGreaterThan(0);
    }
  });
});
