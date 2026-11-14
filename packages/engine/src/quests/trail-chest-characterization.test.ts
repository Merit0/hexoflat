import { describe, expect, it } from 'vitest';
import { deriveStream } from '../utils/random-seeded';
import { axialToOffset, hexDistance, offsetToAxial } from '../utils/hex-utils';
import { questLootNeighbours } from './seeker-chest';
import { generateTrail } from './trail';
import { SEEKER_CARDS } from './seeker-content';
import { SEEKER_CATALOGUE } from './seeker-quests';
import { enterQuest } from './seeker-actions';
import { must, seekerProgress } from './seeker-test-setup';
import { FIELD_CENTER, createTreasureField } from './treasure-field';

const PINNED: Record<string, string[]> = {
  'seeker-1': [
    '19:16',
    '15:10',
    '20:11',
    '20:11',
    '18:17',
    '15:9',
    '18:10',
    '19:10',
    '21:12',
    '18:14',
    '16:16',
    '20:7',
    '21:13',
    '17:13',
    '17:7',
    '15:9',
    '15:15',
    '14:13',
    '18:8',
    '15:13',
  ],
  'seeker-2': [
    '15:15',
    '15:11',
    '15:15',
    '18:10',
    '18:10',
    '20:14',
    '16:13',
    '21:8',
    '17:8',
    '17:11',
    '20:13',
    '15:12',
    '20:15',
    '19:16',
    '17:15',
    '19:15',
    '18:12',
    '14:12',
    '20:11',
    '17:7',
  ],
  'seeker-3': [
    '16:17',
    '19:10',
    '21:11',
    '18:8',
    '18:10',
    '19:11',
    '15:11',
    '19:10',
    '18:8',
    '17:8',
    '21:8',
    '21:13',
    '16:16',
    '17:13',
    '16:14',
    '15:9',
    '18:10',
    '19:14',
    '14:11',
    '15:13',
  ],
};

function chestOf(cardId: string, seed: string): string {
  const field = createTreasureField(seed);
  const entered = must(
    enterQuest(seekerProgress(cardId), {
      questId: cardId,
      catalogue: SEEKER_CATALOGUE,
      seed,
      board: field,
      start: field.start,
      atBoard: true,
      hasRun: false,
    }),
  );
  return `${entered.run.chestHex.columnIndex}:${entered.run.chestHex.rowIndex}`;
}

describe('R-MAP-3 pinned chest hexes with no neighbour missing from the field', () => {
  for (const card of SEEKER_CARDS) {
    it(`${card.id}: 20 fixed seeds give the same chest hex`, () => {
      const seen = Array.from({ length: 20 }, (_, i) => chestOf(card.id, `pin-${card.id}-${i}`));
      expect(seen).toEqual(PINNED[card.id]);
    });
  }
});

describe('REQ-QST-035 the chest has all six neighbours on the field', () => {
  for (const card of SEEKER_CARDS) {
    it(`${card.id}: 500 seeds, five free places besides E, no failed generation, no ring above half`, () => {
      const center = axialToOffset(FIELD_CENTER);
      const rings: Record<number, number> = {};
      let attempts = 0;
      for (let i = 0; i < 500; i += 1) {
        const seed = `sweep-${card.id}-${i}`;
        const field = createTreasureField(seed);
        const stats = { attempts: 0 };
        const made = generateTrail(
          field,
          field.start,
          card.params.steps,
          deriveStream(seed, `quest:${card.id}:trail`),
          stats,
        );
        expect(made, `seed ${i}`).not.toBeNull();
        attempts += stats.attempts;
        const { trail, chestHex } = made!;
        const run = {
          chest: { hex: chestHex },
          collect: null,
          path: [{ hex: trail[trail.length - 1] }],
          start: field.start,
        };
        const free = questLootNeighbours(
          run as unknown as Parameters<typeof questLootNeighbours>[0],
          field,
          offsetToAxial(chestHex),
        ).filter((neighbour) => neighbour.free);
        expect(free, `seed ${i}`).toHaveLength(5);
        const ring = hexDistance(center, chestHex);
        rings[ring] = (rings[ring] ?? 0) + 1;
      }
      expect(Math.max(...Object.values(rings))).toBeLessThanOrEqual(250);
      expect(attempts / 500).toBeLessThan(4);
    });
  }
});
