import { describe, expect, it } from 'vitest';
import { keysOf } from './golden-setup';
import { creatureById } from '../battle/battle-board';
import { hexagonBoard } from '../battle/battle-test-setup';
import {
  ORIGIN,
  RING_OF_TARGET,
  TARGET,
  expectRefused,
  fight,
  king,
  lootAt,
  pickAt,
  setGraveTables,
  play,
  stepTo,
  warrior,
  won,
} from '../battle/collect-test-setup';
import { NOTHING_FIXTURE_TABLE_ID } from '../content/loot-tables.content';
import { lootLeft } from '../battle/collect';
import { fullBag } from '../trade/trade-test-setup';

const OTHER = { q: -1, r: 0 };

function twoGraves() {
  return won([warrior('s1', TARGET), warrior('s2', OTHER)]);
}

describe('CH-P0 grave: check order (matrix row 1)', () => {
  it('standing on a grave beats "no grave there"', () => {
    const onGrave = play(twoGraves(), lootAt(TARGET)).battle;
    expectRefused(onGrave, lootAt({ q: 1, r: 1 }), 'STANDING_ON_TARGET');
  });

  it('standing on a grave beats "grave already examined" when the target is the grave under the hero', () => {
    const onGrave = play(twoGraves(), lootAt(TARGET)).battle;
    expect(onGrave.collect!.graves.find((g) => g.hex.q === TARGET.q)!.examined).toBe(true);
    expectRefused(onGrave, lootAt(TARGET), 'STANDING_ON_TARGET');
  });

  it('standing on a grave beats "not adjacent"', () => {
    const far = won([warrior('s1', TARGET), warrior('s2', { q: -2, r: 0 })]);
    const standing = play(far, lootAt(TARGET)).battle;
    expectRefused(standing, lootAt({ q: -2, r: 0 }), 'STANDING_ON_TARGET');
  });

  it('"no grave there" beats "not adjacent": a far hex without a grave is CONTAINER_EMPTY', () => {
    expectRefused(won([warrior('s1', TARGET)]), lootAt({ q: -3, r: 0 }), 'CONTAINER_EMPTY');
  });

  it('"already examined" beats "not adjacent": a far examined grave is CONTAINER_EMPTY', () => {
    const looted = play(won([warrior('s1', TARGET)]), lootAt(TARGET)).battle;
    const away = play(play(looted, stepTo(ORIGIN)).battle, stepTo({ q: -1, r: 0 })).battle;
    expectRefused(away, lootAt(TARGET), 'CONTAINER_EMPTY');
  });

  it('"not adjacent" beats the room and bag checks', () => {
    const state = won([king('k1', { q: 2, r: 0 })], { board: hexagonBoard(3, RING_OF_TARGET) });
    expectRefused(state, lootAt({ q: 2, r: 0 }), 'NOT_ADJACENT', fullBag());
  });

  it('the fighting phase answers WRONG_PHASE (not BATTLE_ENDED) and changes nothing', () => {
    const state = fight([warrior('s1', TARGET), warrior('s2', { q: 3, r: 0 })]);
    expectRefused(state, lootAt(TARGET), 'WRONG_PHASE');
  });
});

describe('CH-P0 grave: price, hero move, room, bag', () => {
  it('looting is free: no Will event, the hero keeps every field but the position', () => {
    const state = won([warrior('s1', TARGET)], { seed: 'golden-3' });
    const before = structuredClone(creatureById(state, 'hero')!);
    const looted = play(state, lootAt(TARGET));
    const after = structuredClone(creatureById(looted.battle, 'hero')!);
    expect({ ...after, pos: ORIGIN }).toEqual({ ...before, pos: ORIGIN });
    expect(looted.events.some((event) => /WILL/.test(event.type))).toBe(false);
  });

  it('a successful loot puts the hero on the grave, examines it and keeps it in the list', () => {
    const looted = play(won([warrior('s1', TARGET)], { seed: 'golden-3' }), lootAt(TARGET));
    expect(creatureById(looted.battle, 'hero')!.pos).toEqual(TARGET);
    expect(looted.battle.collect!.graves).toEqual([
      {
        hex: TARGET,
        tables: ['skeleton-warrior-loot'],
        examined: true,
        container: { id: '1,0', kind: 'grave', at: TARGET, contents: [], status: 'empty' },
      },
    ]);
    expect(looted.battle.collect!.items.length).toBe(2);
  });

  it('no free place and a bag with room: guaranteed drops go to the bag, the hero still moves', () => {
    const state = won([king('k1', TARGET)], { board: hexagonBoard(3, RING_OF_TARGET) });
    const looted = play(state, lootAt(TARGET));
    expect(looted.refused).toBeNull();
    expect(creatureById(looted.battle, 'hero')!.pos).toEqual(TARGET);
    expect(looted.battle.collect!.items).toEqual([]);
  });

  it('no free place, nothing guaranteed: NO_ROOM_FOR_LOOT, nothing changes, the grave stays unexamined', () => {
    const state = won([warrior('s1', TARGET)], {
      board: hexagonBoard(3, RING_OF_TARGET),
      seed: 'golden-3',
    });
    expectRefused(state, lootAt(TARGET), 'NO_ROOM_FOR_LOOT');
    expect(state.collect!.graves[0].examined).toBe(false);
  });

  it('a full bag with guaranteed drops and no place: BAG_FULL', () => {
    const state = won([king('k1', TARGET)], { board: hexagonBoard(3, RING_OF_TARGET) });
    expectRefused(state, lootAt(TARGET), 'BAG_FULL', fullBag());
  });
});

describe('CH-P0 grave: event name and payload', () => {
  it('CONTAINER_OPENED carries exactly actorId, containerId, from, hex, kind, nothing, placed, toBag; placed uses axial hexes', () => {
    const looted = play(won([warrior('s1', TARGET)], { seed: 'golden-3' }), lootAt(TARGET));
    const event = looted.events.find((candidate) => candidate.type === 'CONTAINER_OPENED')!;
    expect(keysOf(event.payload)).toEqual([
      'actorId',
      'containerId',
      'from',
      'hex',
      'kind',
      'nothing',
      'placed',
      'toBag',
    ]);
    const placed = (event.payload as { placed: object[] }).placed;
    expect(Object.keys(placed[0]).sort()).toEqual(['amount', 'hex', 'itemKey']);
    expect(event.payload).toMatchObject({
      actorId: 'hero',
      kind: 'grave',
      hex: TARGET,
      from: ORIGIN,
      nothing: false,
    });
  });
});

describe('CH-P0 grave: empty roll and empty state', () => {
  function emptyGrave() {
    const state = won([warrior('s1', TARGET)]);
    setGraveTables(state, 0, [NOTHING_FIXTURE_TABLE_ID]);
    return state;
  }

  it('an empty roll adds nothing: the hero stays, the grave is examined, the event has nothing: true', () => {
    const looted = play(emptyGrave(), lootAt(TARGET));
    expect(creatureById(looted.battle, 'hero')!.pos).toEqual(ORIGIN);
    expect(looted.battle.collect!.graves[0].examined).toBe(true);
    const event = looted.events.find((candidate) => candidate.type === 'CONTAINER_OPENED')!;
    expect(event.payload).toMatchObject({ nothing: true, placed: [], toBag: [] });
    expect(lootLeft(looted.battle.collect!)).toBe(false);
  });

  it('an examined grave refuses again with CONTAINER_EMPTY and a step back onto it is HEX_BLOCKED', () => {
    const looted = play(won([warrior('s1', TARGET)], { seed: 'golden-3' }), lootAt(TARGET));
    const away = play(looted.battle, stepTo(ORIGIN)).battle;
    expectRefused(away, lootAt(TARGET), 'CONTAINER_EMPTY');
    const back = play(away, stepTo(TARGET));
    expect(back.refused).toBe('HEX_BLOCKED');
  });
});

describe('CH-P0 grave: pickup', () => {
  function withStacks() {
    return play(won([warrior('s1', TARGET)], { seed: 'golden-3' }), lootAt(TARGET)).battle;
  }

  it('picking a stack up is free, takes it whole and removes it; the event has creatureId, hex, itemKey, amount', () => {
    const state = withStacks();
    const stack = state.collect!.items[0];
    const picked = play(state, pickAt(stack.hex));
    expect(picked.refused).toBeNull();
    expect(picked.battle.collect!.items).toHaveLength(1);
    const event = picked.events.find((candidate) => candidate.type === 'LOOT_PICKED')!;
    expect(keysOf(event.payload)).toEqual(['amount', 'creatureId', 'hex', 'itemKey']);
    expect(event.payload).toMatchObject({ itemKey: stack.itemKey, amount: stack.amount });
    expect(picked.events.some((e) => /WILL/.test(e.type))).toBe(false);
  });

  it('no stack on the hex is NO_LOOT_THERE, and it comes before NOT_ADJACENT', () => {
    expectRefused(withStacks(), pickAt({ q: -3, r: 0 }), 'NO_LOOT_THERE');
  });

  it('a far stack is NOT_ADJACENT, and it comes before BAG_FULL', () => {
    const away = play(withStacks(), stepTo(ORIGIN)).battle;
    const far = away.collect!.items.find((item) => item.hex.q === 2)!;
    expectRefused(away, pickAt(far.hex), 'NOT_ADJACENT', fullBag());
  });

  it('a full bag refuses with BAG_FULL and leaves the stack', () => {
    const state = withStacks();
    expectRefused(state, pickAt(state.collect!.items[0].hex), 'BAG_FULL', {
      ...fullBag(),
      capacityKg: 1000,
    });
  });
});
