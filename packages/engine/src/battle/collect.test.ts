import { describe, expect, it } from 'vitest';
import { LOOT_TABLES } from '../content/loot-tables.content';
import { lootStreamLabel, placeLoot, rollLoot } from '../loot';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { fullBag } from '../trade/trade-test-setup';
import { AXIAL_DIRS } from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';
import { applyBattleCommand } from './apply-battle';
import { applyDamage } from './battle-end';
import { BATTLE_RULES } from './battle-content';
import { creatureById } from './battle-board';
import { hexagonBoard, hero, TEST_TOKEN_SECRET } from './battle-test-setup';
import { graveLootSource } from './grave-token-source';
import type { BattleState } from './battle-state';
import { startBattle } from './start-battle';
import { hexKey } from './hex-battle-geom';
import {
  ON,
  ORIGIN,
  TARGET,
  RING_OF_TARGET,
  warrior,
  king,
  fight,
  slay,
  won,
  play,
  lootAt,
  stepTo,
  expectRefused,
} from './collect-test-setup';

describe('REQ-LOOT-077 graves appear at the moment of victory', () => {
  it('makes one grave on each hex where an enemy died, with the table of its kind', () => {
    const state = won([
      warrior('s1', { q: 1, r: 0 }),
      warrior('s2', { q: -1, r: 1 }),
      king('k1', { q: 0, r: 2 }),
    ]);
    expect(state.phase).toBe('ended');
    expect(state.outcome).toBe('victory');
    expect(state.collect!.items).toEqual([]);
    expect(state.collect!.graves).toHaveLength(3);
    const tables = Object.fromEntries(
      state.collect!.graves.map((grave) => [hexKey(grave.hex), grave.tables]),
    );
    expect(tables).toEqual({
      '1,0': ['skeleton-warrior-loot'],
      '-1,1': ['skeleton-warrior-loot'],
      '0,2': ['skeleton-king-loot'],
    });
    expect(state.collect!.graves.every((grave) => !grave.examined)).toBe(true);
  });

  it('announces the graves once, in the same answer as the end of the battle', () => {
    const state = fight([warrior('s1', { q: 1, r: 0 })]);
    const events = applyDamage(state, creatureById(state, 's1')!, 99);
    expect(events.map((event) => event.type)).toEqual([
      'CREATURE_DAMAGED',
      'CREATURE_FELL',
      'BATTLE_ENDED',
      'GRAVES_MARKED',
    ]);
  });

  it('never makes graves while the fight is still going or with the flag off', () => {
    const open = fight([warrior('s1', { q: 1, r: 0 }), warrior('s2', { q: 2, r: 0 })]);
    slay(open, 's1');
    expect(open.collect).toBeUndefined();
    expect(open.phase).not.toBe('ended');

    const off = startBattle(
      {
        id: 'b1',
        seed: 'loot-seed',
        board: hexagonBoard(),
        creatures: [hero(ORIGIN), warrior('s1', { q: 1, r: 0 })],
        tokenSecret: TEST_TOKEN_SECRET,
      },
      { ...BATTLE_RULES, graveLootEnabled: false },
    ).battle;
    slay(off, 's1');
    expect(off.phase).toBe('ended');
    expect(off.collect).toBeUndefined();
    expect(off.lootEnabled).toBeUndefined();
  });

  it('keeps the dead creature standing in the way of nobody during the fight', () => {
    const state = fight([warrior('s1', { q: 1, r: 0 }), warrior('s2', { q: 3, r: 0 })]);
    slay(state, 's1');
    const moved = play(state, stepTo({ q: 1, r: 0 }));
    expect(state.collect).toBeUndefined();
    expect(moved.refused).not.toBe('HEX_BLOCKED');
  });
});

describe('REQ-LOOT-078 several deaths on one hex give one grave', () => {
  function pile(): BattleState {
    const state = fight([warrior('s1', { q: 1, r: 0 }), king('k1', { q: 2, r: 0 })]);
    slay(state, 's1');
    creatureById(state, 'k1')!.pos = { q: 1, r: 0 };
    slay(state, 'k1');
    return state;
  }

  it('holds the loot lists in the order of death', () => {
    const state = pile();
    expect(state.collect!.graves).toHaveLength(1);
    expect(state.collect!.graves[0].tables).toEqual([
      'skeleton-warrior-loot',
      'skeleton-king-loot',
    ]);
  });

  it('merges the coins of both lists into one stack and rolls once', () => {
    const looted = play(pile(), lootAt(TARGET));
    expect(looted.refused).toBeNull();
    const placed = looted.battle.collect!.items;
    const coins = placed.filter((item) => item.itemKey === HEXOBJECT_KEYS.COINS);
    expect(coins.length).toBeLessThanOrEqual(1);
    expect(coins[0].amount).toBeGreaterThanOrEqual(30);
    expect(looted.battle.collect!.graves[0].examined).toBe(true);
  });

  it('puts the loot of the earlier death first', () => {
    const state = fight([king('k1', { q: 1, r: 0 }), warrior('s1', { q: 2, r: 0 })]);
    slay(state, 'k1');
    creatureById(state, 's1')!.pos = { q: 1, r: 0 };
    slay(state, 's1');
    expect(state.collect!.graves[0].tables).toEqual([
      'skeleton-king-loot',
      'skeleton-warrior-loot',
    ]);
  });
});

describe('REQ-LOOT-079 standing on a grave', () => {
  function standing(): BattleState {
    const state = fight([warrior('s1', TARGET)]);
    creatureById(state, 'hero')!.pos = { ...TARGET };
    slay(state, 's1');
    return state;
  }

  it('refuses LOOT_GRAVE on the grave under the hero until he steps off', () => {
    const state = standing();
    expectRefused(state, lootAt(TARGET), 'STANDING_ON_TARGET');
    const off = play(state, stepTo(ORIGIN));
    expect(off.refused).toBeNull();
    const looted = play(off.battle, lootAt(TARGET));
    expect(looted.refused).toBeNull();
    expect(creatureById(looted.battle, 'hero')!.pos).toEqual(TARGET);
  });

  it('refuses LOOT_GRAVE on another grave while the hero stands on one', () => {
    const state = fight([warrior('s1', TARGET), warrior('s2', { q: 2, r: -1 })]);
    creatureById(state, 'hero')!.pos = { ...TARGET };
    slay(state, 's1', 's2');
    expectRefused(state, lootAt({ q: 2, r: -1 }), 'STANDING_ON_TARGET');
  });
});

describe('REQ-LOOT-080 every refusal changes nothing', () => {
  const lone = () => won([warrior('s1', TARGET)]);

  it('refuses a hex without a grave', () => {
    expectRefused(lone(), lootAt({ q: 0, r: 1 }), 'CONTAINER_EMPTY');
  });

  it('refuses a grave that is not adjacent', () => {
    const state = won([warrior('s1', { q: 2, r: 0 })]);
    expectRefused(state, lootAt({ q: 2, r: 0 }), 'NOT_ADJACENT');
  });

  it('refuses a grave that was already examined', () => {
    const looted = play(lone(), lootAt(TARGET));
    const away = play(looted.battle, stepTo(ORIGIN));
    expectRefused(away.battle, lootAt(TARGET), 'CONTAINER_EMPTY');
  });

  it('refuses with NO_ROOM_FOR_LOOT when nothing is guaranteed and no place is free', () => {
    const state = won([warrior('s1', TARGET)], { board: hexagonBoard(3, RING_OF_TARGET) });
    expectRefused(state, lootAt(TARGET), 'NO_ROOM_FOR_LOOT');
  });

  it('refuses with BAG_FULL when guaranteed drops cannot go to a full bag', () => {
    const state = won([king('k1', TARGET)], { board: hexagonBoard(3, RING_OF_TARGET) });
    expectRefused(state, lootAt(TARGET), 'BAG_FULL', fullBag());
  });

  it('refuses in the fighting phase with WRONG_PHASE', () => {
    const state = fight([warrior('s1', TARGET), warrior('s2', { q: 3, r: 0 })]);
    const result = play(state, lootAt(TARGET));
    expect(result.refused).toBe('WRONG_PHASE');
    expect(JSON.stringify(result.battle)).toBe(JSON.stringify(state));
  });

  it('refuses a dead hero', () => {
    const state = fight([warrior('s1', TARGET), hero({ q: -1, r: 0 }, { id: 'hero-2', hp: 6 })]);
    state.creatures.find((c) => c.id === 'hero-2')!.hp = 0;
    slay(state, 's1');
    const result = applyBattleCommand(
      state,
      {
        type: 'BATTLE',
        payload: { kind: 'hero', heroId: 'hero-2', atMs: 0, action: stepTo({ q: -2, r: 0 }) },
      },
      ON,
    );
    expect(result.events[0].type).toBe('BATTLE_REJECTED');
  });
});

describe('REQ-LOOT-081 a successful LOOT_GRAVE', () => {
  const seedOf = (n: number) => `seed-${n}`;

  const secretOf = (seed: string) => ({ seed, mapId: TEST_TOKEN_SECRET.mapId });

  function expected(seed: string, id = 'b1') {
    const source = graveLootSource({ id, tokenSecret: secretOf(seed) }, hexKey(TARGET));
    const rng = deriveStream(source.seed, lootStreamLabel(source.sourceId, source.targetKey));
    const drops = rollLoot(LOOT_TABLES['skeleton-warrior-loot'], rng);
    return placeLoot({
      target: TARGET,
      entry: ORIGIN,
      neighbours: AXIAL_DIRS.map((dir) => ({
        hex: { q: TARGET.q + dir.q, r: TARGET.r + dir.r },
        free: true,
      })),
      drops: [drops],
    });
  }

  it('places exactly what placeLoot gives for the same token secret', () => {
    for (let n = 0; n < 20; n++) {
      const looted = play(
        won([warrior('s1', TARGET)], { tokenSecret: secretOf(seedOf(n)) }),
        lootAt(TARGET),
      );
      const plan = expected(seedOf(n));
      if (plan.kind !== 'placed') throw new Error('expected a placement');
      expect(looted.battle.collect!.items).toEqual(
        plan.placements.map(({ hex, itemKey, amount }) => ({ hex, itemKey, amount })),
      );
    }
  });

  it('moves the hero onto the grave, leaves the entry hex empty and marks the grave examined', () => {
    const looted = play(won([warrior('s1', TARGET)]), lootAt(TARGET));
    expect(creatureById(looted.battle, 'hero')!.pos).toEqual(TARGET);
    expect(looted.battle.collect!.graves[0].examined).toBe(true);
    expect(looted.battle.collect!.items.some((item) => item.hex.q === 0 && item.hex.r === 0)).toBe(
      false,
    );
    expect(looted.events.map((event) => event.type)).toEqual(['CONTAINER_OPENED']);
    expect(looted.inventory!.revision).toBe(0);
  });

  it('refuses to step back onto the examined grave', () => {
    const looted = play(won([warrior('s1', TARGET)]), lootAt(TARGET));
    const off = play(looted.battle, stepTo(ORIGIN));
    expect(off.refused).toBeNull();
    expectRefused(off.battle, stepTo(TARGET), 'HEX_BLOCKED');
  });

  it('gives the same loot for the same secret and grave, a different stream for another battle', () => {
    const seeds = Array.from({ length: 12 }, (_, n) => seedOf(n));
    const list = (id: string) =>
      seeds.map(
        (seed) =>
          play(won([king('k1', TARGET)], { tokenSecret: secretOf(seed), id }), lootAt(TARGET))
            .battle.collect!.items,
      );
    expect(list('b1')).toEqual(list('b1'));
    expect(list('b1')).not.toEqual(list('b2'));
  });
});
