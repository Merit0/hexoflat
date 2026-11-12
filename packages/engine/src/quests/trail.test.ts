import { describe, expect, it } from 'vitest';
import { deriveStream } from '../utils/random-seeded';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { SEEKER_CARDS } from './seeker-content';
import { generateTrail } from './trail';
import { discBoard } from './seeker-test-setup';

describe('REQ-QST-006 the trail on a board', () => {
  for (const card of SEEKER_CARDS) {
    it(`${card.id}: ${card.params.steps} hexes that touch only their neighbours in the trail, with room around`, () => {
      const board = discBoard();
      const floor = new Set(board.floor.map(coordinateKey));
      for (let seed = 0; seed < 200; seed += 1) {
        const generated = generateTrail(
          board,
          board.start,
          card.params.steps,
          deriveStream(`seed-${seed}`, 'trail'),
        );
        expect(generated, `seed ${seed}`).not.toBeNull();
        const { trail, chestHex } = generated!;
        expect(trail).toHaveLength(card.params.steps);
        const keys = trail.map(coordinateKey);
        expect(new Set(keys).size).toBe(keys.length);
        const startRing = new Set(getHexNeighbors(board.start).map(coordinateKey));
        trail.forEach((hex, index) => {
          expect(floor.has(coordinateKey(hex))).toBe(true);
          expect(startRing.has(coordinateKey(hex))).toBe(index === 0);
          const touching = getHexNeighbors(hex)
            .map(coordinateKey)
            .filter((key) => keys.includes(key));
          const allowed = [keys[index - 1], keys[index + 1]].filter(Boolean);
          expect([...touching].sort()).toEqual([...allowed].sort());
        });
        const last = trail[trail.length - 1];
        const chestKey = coordinateKey(chestHex);
        expect(getHexNeighbors(last).map(coordinateKey)).toContain(chestKey);
        expect(
          getHexNeighbors(chestHex)
            .map(coordinateKey)
            .filter((key) => keys.includes(key)),
        ).toEqual([coordinateKey(last)]);
        const freeAroundChest = getHexNeighbors(chestHex).filter(
          (hex) => floor.has(coordinateKey(hex)) && coordinateKey(hex) !== coordinateKey(last),
        );
        expect(freeAroundChest.length).toBeGreaterThanOrEqual(3);
        for (const hex of trail) {
          const free = getHexNeighbors(hex).filter((n) => {
            const key = coordinateKey(n);
            return (
              floor.has(key) &&
              !keys.includes(key) &&
              key !== chestKey &&
              key !== coordinateKey(board.start)
            );
          });
          expect(free.length).toBeGreaterThanOrEqual(2);
        }
      }
    });
  }
});
