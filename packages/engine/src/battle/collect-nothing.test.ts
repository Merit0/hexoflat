import { describe, expect, it } from 'vitest';
import { NOTHING_FIXTURE_TABLE_ID } from '../content/loot-tables.content';
import { creatureById } from './battle-board';
import { hexagonBoard } from './battle-test-setup';
import {
  ORIGIN,
  RING_OF_TARGET,
  TARGET,
  expectRefused,
  lootAt,
  play,
  stepTo,
  warrior,
  won,
  setGraveTables,
} from './collect-test-setup';

function emptyGrave(board = hexagonBoard()) {
  const state = won([warrior('s1', TARGET)], { board });
  setGraveTables(state, 0, [NOTHING_FIXTURE_TABLE_ID]);
  return state;
}

describe('REQ-LOOT-100 a grave with an empty loot list', () => {
  it('answers "nothing", examines the grave and leaves the hero where he stands', () => {
    const looted = play(emptyGrave(), lootAt(TARGET));
    expect(looted.refused).toBeNull();
    expect(creatureById(looted.battle, 'hero')!.pos).toEqual(ORIGIN);
    expect(looted.battle.collect!.graves[0].examined).toBe(true);
    expect(looted.battle.collect!.items).toEqual([]);
    expect(looted.events.map((event) => event.type)).toEqual(['CONTAINER_OPENED']);
    expect(looted.events[0].payload).toMatchObject({ placed: [], toBag: [], nothing: true });
    expect(looted.inventory!.revision).toBe(0);
  });

  it('does not need a free place: a boxed-in grave still answers "nothing"', () => {
    const state = emptyGrave(hexagonBoard(3, RING_OF_TARGET));
    const looted = play(state, lootAt(TARGET));
    expect(looted.refused).toBeNull();
    expect(looted.battle.collect!.graves[0].examined).toBe(true);
  });

  it('keeps an examined grave non-enterable and refuses a second eye without a change', () => {
    const looted = play(emptyGrave(), lootAt(TARGET));
    expectRefused(looted.battle, lootAt(TARGET), 'CONTAINER_EMPTY');
    expectRefused(looted.battle, stepTo(TARGET), 'HEX_BLOCKED');
  });

  it('counts as no loot left', () => {
    const looted = play(emptyGrave(), lootAt(TARGET));
    expect(play(looted.battle, stepTo({ q: 0, r: 1 })).refused).toBeNull();
  });

  it('a grave with no table at all gives the same answer', () => {
    const state = emptyGrave();
    setGraveTables(state, 0, []);
    const looted = play(state, lootAt(TARGET));
    expect(looted.events[0].payload).toMatchObject({ nothing: true });
  });
});

describe('REQ-LOOT-101 the eye during the fight', () => {
  it('is refused with WRONG_PHASE and changes nothing', () => {
    const fighting = emptyGrave();
    fighting.phase = 'act';
    fighting.outcome = undefined;
    fighting.collect = undefined;
    expectRefused(fighting, lootAt(TARGET), 'WRONG_PHASE');
  });
});
