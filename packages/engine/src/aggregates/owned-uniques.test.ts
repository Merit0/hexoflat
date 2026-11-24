import { describe, expect, it } from 'vitest';
import { AGGREGATES, upcastAggregate } from './registry';
import { emptyProgressState, progressStateSchema } from './progress-state';

const HERO = 'hero-1';

describe('progress.ownedUniques is removed (DA5a-2, Q5)', () => {
  it('declares progress schema version 13 without the field', () => {
    expect(AGGREGATES.progress.schemaVersion).toBe(13);
    expect(emptyProgressState(HERO)).not.toHaveProperty('ownedUniques');
    expect(
      progressStateSchema.safeParse({ ...emptyProgressState(HERO), ownedUniques: [] }).success,
    ).toBe(false);
  });

  it('upcasts a v9 document without the field', () => {
    const v9 = JSON.parse(JSON.stringify(emptyProgressState(HERO))) as Record<string, unknown>;
    expect(upcastAggregate('progress', 9, v9, { heroId: HERO })).toEqual(emptyProgressState(HERO));
  });

  it.each([[[]], [['lantern-eater', 'last-verdict']]])(
    'drops only ownedUniques %j from a v12 document',
    (ownedUniques) => {
      const current = { ...emptyProgressState(HERO), steps: 41, kills: 3, trips: 2 };
      const v12 = { ...current, ownedUniques };
      const before = structuredClone(v12);
      expect(upcastAggregate('progress', 12, v12, { heroId: HERO })).toEqual(current);
      expect(v12).toEqual(before);
    },
  );
});
