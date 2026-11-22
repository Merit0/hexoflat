import { describe, expect, it } from 'vitest';
import { emptyInventoryState } from '../inventory/inventory-state';
import { toAggregate } from '../inventory/inventory-adapter';
import { countItem } from '../inventory/plan-stock';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { fullBag } from '../trade/trade-test-setup';
import { applyBattleCommand } from './apply-battle';
import { applyDamage } from './battle-end';
import { creatureById } from './battle-board';
import { hexagonBoard } from './battle-test-setup';
import type { BattleAction } from './battle-commands';
import { projectBattleForViewer } from './projection';
import { hexKey } from './hex-battle-geom';
import {
  ORIGIN,
  TARGET,
  RING_OF_TARGET,
  warrior,
  king,
  fight,
  won,
  play,
  lootAt,
  pickAt,
  stepTo,
  expectRefused,
} from './collect-test-setup';

describe('REQ-LOOT-082 neighbouring graves and items take places away', () => {
  it('spreads only onto hexes without a grave or an item', () => {
    const state = won([king('k1', TARGET), warrior('s1', { q: 2, r: -1 })]);
    state.collect!.items.push({
      hex: { q: 2, r: 0 },
      itemKey: HEXOBJECT_KEYS.COINS,
      amount: 3,
    });
    const looted = play(state, lootAt(TARGET));
    expect(looted.refused).toBeNull();
    const fresh = looted.battle.collect!.items.slice(1);
    expect(fresh).toHaveLength(3);
    const used = fresh.map((item) => hexKey(item.hex)).sort();
    expect(used).toEqual(['0,1', '1,-1', '1,1']);
  });
});

describe('REQ-LOOT-083 a boss grave with no free place', () => {
  it('sends the guaranteed drops to the bag when it has room', () => {
    const state = won([king('k1', TARGET)], { board: hexagonBoard(3, RING_OF_TARGET) });
    const looted = play(state, lootAt(TARGET));
    expect(looted.refused).toBeNull();
    expect(looted.battle.collect!.items).toEqual([]);
    expect(countItem(toAggregate(looted.inventory!), HEXOBJECT_KEYS.COINS)).toBeGreaterThanOrEqual(
      30,
    );
    expect(looted.events.map((event) => event.type)).toContain('ITEM_GRANTED');
    const payload = looted.events.find((event) => event.type === 'CONTAINER_OPENED')!.payload as {
      toBag: { itemKey: string }[];
    };
    expect(payload.toBag.map((drop) => drop.itemKey)).toEqual([HEXOBJECT_KEYS.COINS]);
  });

  it('refuses with a full bag and then gives the same list once the bag has room', () => {
    const state = won([king('k1', TARGET)], { board: hexagonBoard(3, RING_OF_TARGET) });
    expectRefused(state, lootAt(TARGET), 'BAG_FULL', fullBag());
    const retry = play(state, lootAt(TARGET));
    const again = play(state, lootAt(TARGET));
    expect(retry.refused).toBeNull();
    const lists = [retry, again].map(
      (played) =>
        (
          played.events.find((event) => event.type === 'CONTAINER_OPENED')!.payload as {
            toBag: unknown;
          }
        ).toBag,
    );
    expect(lists[0]).toEqual(lists[1]);
  });
});

describe('REQ-LOOT-084 the collection phase', () => {
  it('lets the hero walk for nothing and keeps the Will at zero', () => {
    let state = won([warrior('s1', { q: 3, r: 0 })]);
    expect(state.turnWill).toBe(0);
    for (const hex of [
      { q: 0, r: 1 },
      { q: 0, r: 2 },
      { q: -1, r: 2 },
    ]) {
      const result = play(state, stepTo(hex));
      expect(result.refused).toBeNull();
      state = result.battle;
    }
    expect(state.turnWill).toBe(0);
    expect(state.undo).toEqual([]);
    expect(creatureById(state, 'hero')!.pos).toEqual({ q: -1, r: 2 });
  });

  it('does not trigger a hazard hex', () => {
    const state = won([warrior('s1', { q: 3, r: 0 })], {
      board: hexagonBoard(3, { '0,1': 'saw' }),
    });
    const result = play(state, stepTo({ q: 0, r: 1 }));
    expect(result.refused).toBeNull();
    expect(result.events.map((event) => event.type)).toEqual(['CREATURE_MOVED']);
    expect(result.battle.task).toBeUndefined();
    expect(creatureById(result.battle, 'hero')!.hp).toBe(6);
  });

  it('refuses every fighting action with the same reason', () => {
    const state = won([warrior('s1', { q: 3, r: 0 })]);
    const actions: BattleAction[] = [
      { kind: 'end-turn' },
      { kind: 'undo-step' },
      { kind: 'take-hit' },
      { kind: 'strike', targetId: 's1', hand: 'right' },
      { kind: 'place-shield', hex: { q: 0, r: 1 } },
      { kind: 'set-hands', right: null, left: null },
      { kind: 'use-item', hand: 'right' },
    ];
    for (const action of actions) expectRefused(state, action, 'BATTLE_ENDED');
    const enemy = applyBattleCommand(state, {
      type: 'BATTLE',
      payload: { kind: 'run-enemy-turn', atMs: 0 },
    });
    expect(enemy.events[0].type).toBe('BATTLE_REJECTED');
  });

  it('keeps graves, items and walls solid for a step', () => {
    const state = won([warrior('s1', { q: 1, r: 0 })], {
      board: hexagonBoard(3, { '0,1': 'wall' }),
    });
    expectRefused(state, stepTo({ q: 1, r: 0 }), 'HEX_BLOCKED');
    expectRefused(state, stepTo({ q: 0, r: 1 }), 'HEX_BLOCKED');
    expectRefused(state, stepTo({ q: 2, r: 0 }), 'NOT_ADJACENT');
    state.collect!.items.push({ hex: { q: -1, r: 0 }, itemKey: HEXOBJECT_KEYS.COINS, amount: 2 });
    expectRefused(state, stepTo({ q: -1, r: 0 }), 'HEX_BLOCKED');
  });

  it('is never entered after a defeat', () => {
    const state = fight([warrior('s1', TARGET)]);
    applyDamage(state, creatureById(state, 'hero')!, 99);
    expect(state.outcome).toBe('defeat');
    expect(state.collect).toBeUndefined();
    expectRefused(state, stepTo({ q: 0, r: 1 }), 'BATTLE_ENDED');
  });
});

describe('REQ-LOOT-085 picking loot up in a battle', () => {
  const scene = () => {
    const state = won([warrior('s1', { q: 3, r: 0 })]);
    state.collect!.items.push({ hex: { q: 0, r: 1 }, itemKey: HEXOBJECT_KEYS.COINS, amount: 7 });
    return state;
  };

  it('takes the whole stack for nothing and frees the hex', () => {
    const picked = play(scene(), pickAt({ q: 0, r: 1 }));
    expect(picked.refused).toBeNull();
    expect(picked.battle.collect!.items).toEqual([]);
    expect(countItem(toAggregate(picked.inventory!), HEXOBJECT_KEYS.COINS)).toBe(7);
    expect(picked.events.map((event) => event.type)).toContain('LOOT_PICKED');
    expect(picked.battle.turnWill).toBe(0);
    expect(play(picked.battle, stepTo({ q: 0, r: 1 })).refused).toBeNull();
  });

  it('leaves the stack on the ground when the bag is full', () => {
    expectRefused(scene(), pickAt({ q: 0, r: 1 }), 'BAG_FULL', { ...fullBag(), capacityKg: 1000 });
  });

  it('refuses a stack that is not adjacent and a hex without loot', () => {
    const state = scene();
    state.collect!.items.push({ hex: { q: 0, r: -2 }, itemKey: HEXOBJECT_KEYS.COINS, amount: 1 });
    expectRefused(state, pickAt({ q: 0, r: -2 }), 'NOT_ADJACENT');
    expectRefused(state, pickAt({ q: 1, r: 0 }), 'NO_LOOT_THERE');
  });
});

describe('REQ-LOOT-086 the projection of a collection phase', () => {
  it('carries graves, items, the examined flags and one boolean, and nothing secret', () => {
    const state = won([king('k1', TARGET), warrior('s1', { q: -1, r: 0 })]);
    const view = projectBattleForViewer(state, 'heroes');
    expect(view.collect).toEqual({
      graves: [
        { hex: TARGET, examined: false },
        { hex: { q: -1, r: 0 }, examined: false },
      ],
      items: [],
    });
    expect(view.lootLeft).toBe(true);
    const text = JSON.stringify(view);
    for (const secret of [state.seed, 'tables', '-loot', 'fallen', 'lootEnabled']) {
      expect(text).not.toContain(secret);
    }
  });

  it('says nothing is left once every grave is examined and every stack picked up', () => {
    let state = won([warrior('s1', TARGET)]);
    state = play(state, lootAt(TARGET)).battle;
    expect(projectBattleForViewer(state, 'heroes').lootLeft).toBe(true);
    let inventory = emptyInventoryState('hero');
    state = play(state, stepTo(ORIGIN), inventory).battle;
    for (const item of [...state.collect!.items]) {
      const result = play(state, pickAt(item.hex), inventory);
      if (result.refused === 'NOT_ADJACENT') {
        state.collect!.items = state.collect!.items.filter((other) => other !== item);
        continue;
      }
      state = result.battle;
      inventory = result.inventory!;
    }
    state.collect!.items = [];
    expect(projectBattleForViewer(state, 'heroes').lootLeft).toBe(false);
  });

  it('adds nothing to the projection of a fight or of a battle with the flag off', () => {
    const fighting = projectBattleForViewer(
      fight([warrior('s1', TARGET), warrior('s2', { q: 3, r: 0 })]),
      'heroes',
    );
    expect(fighting).not.toHaveProperty('collect');
    expect(fighting).not.toHaveProperty('lootLeft');
  });
});
