import { describe, expect, it } from 'vitest';
import { runBoardPipeline } from '../boards/pipeline/run-board-pipeline';
import { BATTLEFIELD_CRYPT_MODEL } from '../content/boards/models/battlefield-crypt';
import { battleDistance, hexNeighbours, hexKey, parseHexKey } from './hex-battle-geom';
import { battlefieldSeed, generateBattlefield, type Battlefield } from './battlefield';

function count(field: Battlefield, terrain: string): number {
  return Object.values(field.board).filter((t) => t === terrain).length;
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
  it('builds the same board from the same encounter and attempt', () => {
    const seed = battlefieldSeed('enc-7', 0);
    expect(generateBattlefield('crypt', seed)).toEqual(generateBattlefield('crypt', seed));
    expect(generateBattlefield('crypt', battlefieldSeed('enc-7', 1))).not.toEqual(
      generateBattlefield('crypt', seed),
    );
  });

  it('passes the tactical budget on 200 seeds without the fallback board', () => {
    for (let n = 0; n < 200; n++) {
      const seed = battlefieldSeed(`enc-${n}`, 0);
      const pipeline = runBoardPipeline(BATTLEFIELD_CRYPT_MODEL, { seed });
      expect(pipeline.descriptor, seed).toMatchObject({ kind: 'RECIPE', seed });
      expect((pipeline.descriptor as { attempt: number }).attempt, seed).toBeLessThan(12);

      const field = generateBattlefield('crypt', seed);
      expect(count(field, 'saw'), seed).toBeGreaterThanOrEqual(1);
      expect(count(field, 'saw'), seed).toBeLessThanOrEqual(2);
      expect(count(field, 'ledge'), seed).toBeGreaterThanOrEqual(1);
      const cover = count(field, 'wall') + field.boulders.length;
      expect(cover, seed).toBeGreaterThanOrEqual(2);
      expect(cover, seed).toBeLessThanOrEqual(4);
      expect(hasPushCombo(field), seed).toBe(true);
      expect(walkableConnected(field), seed).toBe(true);
    }
  });

  it('is a natural hexagon of radius 4 centred on 0,0, no wider than 11 by 9', () => {
    const field = generateBattlefield('crypt', battlefieldSeed('enc-shape', 0));
    const hexes = Object.keys(field.board).map(parseHexKey);
    expect(hexes.every((h) => battleDistance(h, { q: 0, r: 0 }) <= 4)).toBe(true);
    expect(hexes.length).toBeLessThan(61);
    expect(hexes.length).toBeGreaterThanOrEqual(57);
    expect(field.board['0,0']).toBeDefined();
  });
});
