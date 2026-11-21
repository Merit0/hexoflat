import { describe, expect, it } from 'vitest';
import { AGGREGATES, upcastAggregate } from './registry';
import { emptyProgressState, progressStateSchema } from './progress-state';

const HERO = 'hero-1';

describe('progress.ownedUniques (LG5a)', () => {
  it('declares progress schema version 11 and starts a new hero with no uniques', () => {
    expect(AGGREGATES.progress.schemaVersion).toBe(11);
    expect(emptyProgressState(HERO).ownedUniques).toEqual([]);
  });

  it('upcasts a v9 document with an empty list', () => {
    const v9 = JSON.parse(JSON.stringify(emptyProgressState(HERO))) as Record<string, unknown>;
    delete v9.ownedUniques;
    expect(upcastAggregate('progress', 9, v9, { heroId: HERO })).toEqual(emptyProgressState(HERO));
  });

  it('keeps owned unique keys and refuses a key that is not a slug', () => {
    const state = { ...emptyProgressState(HERO), ownedUniques: ['lantern-eater'] };
    expect(progressStateSchema.parse(state).ownedUniques).toEqual(['lantern-eater']);
    expect(progressStateSchema.safeParse({ ...state, ownedUniques: ['Bad Key'] }).success).toBe(
      false,
    );
  });
});
