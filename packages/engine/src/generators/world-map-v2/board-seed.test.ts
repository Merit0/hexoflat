import { describe, expect, it } from 'vitest';
import { attemptSeed, boardSeed } from './board-seed';

const BASE_INPUT = {
  worldSeed: 'world-abc',
  generationVersion: 1,
  locationKey: 'silesia' as const,
  profile: 'WORLD' as const,
};

describe('boardSeed', () => {
  it('is deterministic for the same inputs', () => {
    expect(boardSeed(BASE_INPUT)).toBe(boardSeed({ ...BASE_INPUT }));
  });

  it('changes when any input changes', () => {
    const base = boardSeed(BASE_INPUT);

    expect(boardSeed({ ...BASE_INPUT, worldSeed: 'world-xyz' })).not.toBe(base);
    expect(boardSeed({ ...BASE_INPUT, generationVersion: 2 })).not.toBe(base);
    expect(boardSeed({ ...BASE_INPUT, locationKey: 'cave' })).not.toBe(base);
    expect(boardSeed({ ...BASE_INPUT, profile: 'DUNGEON' })).not.toBe(base);
  });
});

describe('attemptSeed', () => {
  it('is deterministic per attempt index', () => {
    const root = boardSeed(BASE_INPUT);

    expect(attemptSeed(root, 3)).toBe(attemptSeed(root, 3));
  });

  it('differs across attempt indices without touching the board seed', () => {
    const root = boardSeed(BASE_INPUT);

    expect(attemptSeed(root, 0)).not.toBe(attemptSeed(root, 1));
    expect(attemptSeed(root, 0)).not.toBe(root);
  });
});
