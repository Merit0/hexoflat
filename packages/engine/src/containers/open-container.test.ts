import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../commands/types';
import { emptyInventoryState } from '../inventory/inventory-state';
import type { LootDrop, LootNeighbour } from '../loot';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { fullBag } from '../trade/trade-test-setup';
import { AXIAL_DIRS, type Axial } from '../utils/hex-utils';
import type { ContainerState } from './container';
import { openContainer, type OpenInput } from './open-container';
import { openInSpace, type ContainerSpace } from './open-in-space';

const AT: Axial = { q: 0, r: 0 };
const HERO: Axial = { q: 1, r: 0 };
const FAR: Axial = { q: 3, r: 0 };

const COINS: LootDrop = { itemKey: HEXOBJECT_KEYS.COINS, amount: 20, guaranteed: true };
const BOTTLE: LootDrop = { itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, amount: 1, guaranteed: false };

const chest = (patch: Partial<ContainerState> = {}): ContainerState => ({
  id: 'c1',
  kind: 'chest',
  at: AT,
  contents: null,
  status: 'full',
  ...patch,
});

function ring(free: number): LootNeighbour[] {
  return AXIAL_DIRS.map((dir, index) => ({
    hex: { q: dir.q, r: dir.r },
    free: index >= AXIAL_DIRS.length - free,
  }));
}

function input(patch: Partial<OpenInput> = {}): OpenInput {
  return {
    actorAt: HERO,
    standing: false,
    container: chest(),
    contents: [[BOTTLE]],
    neighbours: ring(6),
    bag: { current: emptyInventoryState('h'), events: [] },
    ...patch,
  };
}

describe('CH-P4a openContainer: every refusal', () => {
  it('STANDING_ON_TARGET', () => {
    expect(openContainer(input({ standing: true }))).toEqual({
      ok: false,
      reason: 'STANDING_ON_TARGET',
    });
  });

  it('CONTAINER_EMPTY', () => {
    expect(openContainer(input({ container: chest({ status: 'empty' }) }))).toEqual({
      ok: false,
      reason: 'CONTAINER_EMPTY',
    });
  });

  it('NOT_ADJACENT', () => {
    expect(openContainer(input({ actorAt: FAR }))).toEqual({ ok: false, reason: 'NOT_ADJACENT' });
  });

  it('NO_ROOM_FOR_LOOT when nothing is guaranteed and no place is free', () => {
    expect(openContainer(input({ neighbours: ring(0) }))).toEqual({
      ok: false,
      reason: 'NO_ROOM_FOR_LOOT',
    });
  });

  it('BAG_FULL when a guaranteed drop must go to a full bag', () => {
    const bag = { current: fullBag(HEXOBJECT_KEYS.SWORD), events: [] };
    expect(openContainer(input({ neighbours: ring(0), contents: [[COINS]], bag }))).toEqual({
      ok: false,
      reason: 'BAG_FULL',
    });
  });
});

describe('CH-P4a openContainer: double conditions, today the winner is', () => {
  it('standing AND empty -> STANDING_ON_TARGET', () => {
    const outcome = openContainer(input({ standing: true, container: chest({ status: 'empty' }) }));
    expect(outcome).toMatchObject({ reason: 'STANDING_ON_TARGET' });
  });

  it('empty AND not adjacent -> CONTAINER_EMPTY', () => {
    const outcome = openContainer(input({ actorAt: FAR, container: chest({ status: 'empty' }) }));
    expect(outcome).toMatchObject({ reason: 'CONTAINER_EMPTY' });
  });

  it('not adjacent AND no room -> NOT_ADJACENT', () => {
    expect(openContainer(input({ actorAt: FAR, neighbours: ring(0) }))).toMatchObject({
      reason: 'NOT_ADJACENT',
    });
  });
});

describe('CH-P4a openContainer: success shapes', () => {
  it('empty contents: ok, nothing true, an empty plan, the container becomes empty, even with no room', () => {
    const outcome = openContainer(input({ contents: [[]], neighbours: ring(0) }));
    expect(outcome).toEqual({
      ok: true,
      nothing: true,
      plan: { placements: [], toBag: [] },
      container: chest({ status: 'empty' }),
    });
  });

  it('a roomy opening places the drops and sends nothing to the bag', () => {
    const outcome = openContainer(input({ contents: [[BOTTLE, BOTTLE]] }));
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.nothing).toBe(false);
    expect(outcome.plan.placements.length).toBeGreaterThan(0);
    expect(outcome.plan.toBag).toEqual([]);
    expect(outcome.container.status).toBe('empty');
  });

  it('no place and a guaranteed drop: it goes to the bag', () => {
    const outcome = openContainer(input({ contents: [[COINS]], neighbours: ring(0) }));
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.plan.placements).toEqual([]);
    expect(outcome.plan.toBag).toEqual([{ itemKey: HEXOBJECT_KEYS.COINS, amount: 20 }]);
  });

  it('one free place, two guaranteed drops: placed and toBag both filled', () => {
    const outcome = openContainer(
      input({ contents: [[COINS, { ...BOTTLE, guaranteed: true }]], neighbours: ring(1) }),
    );
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.plan.placements.length).toBe(1);
    expect(outcome.plan.toBag.length).toBe(1);
  });

  it('several loot lists on one container pass through together', () => {
    const outcome = openContainer(input({ contents: [[BOTTLE], [BOTTLE]] }));
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.plan.placements.length).toBe(2);
  });

  it('is pure: the bag draft is not touched', () => {
    const bag = { current: emptyInventoryState('h'), events: [] as DomainEvent[] };
    openContainer(input({ contents: [[COINS]], neighbours: ring(0), bag }));
    expect(bag.events).toEqual([]);
    expect(bag.current).toEqual(emptyInventoryState('h'));
  });
});

type Fake = { standing: boolean; hero: Axial; container: ContainerState | null; log: string[] };

function space(): ContainerSpace<Fake, string, 'NO_HERO'> {
  return {
    preconditions: (state) => (state.hero ? null : 'NO_HERO'),
    actorAt: (state) => state.hero,
    standsOnContainer: (state) => state.standing,
    containerAt: (state) => state.container,
    neighbours: () => ring(6),
    rollContents: (state) => {
      state.log.push('rolled');
      return [[BOTTLE]];
    },
    apply: (state) => {
      state.log.push('applied');
      return [{ type: 'OPENED', payload: {} }];
    },
    refusalEvents: (_state, _actor, _target, reason) => [{ type: 'REFUSED', payload: { reason } }],
  };
}

const bag = () => ({ current: emptyInventoryState('h'), events: [] as DomainEvent[] });

describe('CH-P4a openInSpace', () => {
  const base = (): Fake => ({ standing: false, hero: HERO, container: chest(), log: [] });

  it('a space precondition comes first, before any other check', () => {
    const state = { ...base(), hero: undefined as unknown as Axial, standing: true };
    expect(openInSpace(space(), state, 'h', 'x', bag())).toMatchObject({
      ok: false,
      reason: 'NO_HERO',
      events: [{ type: 'REFUSED', payload: { reason: 'NO_HERO' } }],
    });
  });

  it('standing beats a missing container; a missing container is CONTAINER_EMPTY', () => {
    expect(
      openInSpace(space(), { ...base(), standing: true, container: null }, 'h', 'x', bag()),
    ).toMatchObject({
      reason: 'STANDING_ON_TARGET',
    });
    expect(openInSpace(space(), { ...base(), container: null }, 'h', 'x', bag())).toMatchObject({
      reason: 'CONTAINER_EMPTY',
    });
  });

  it('contents null: the space rolls lazily, once, after the access checks', () => {
    const state = base();
    const refused = openInSpace(space(), { ...state, standing: true }, 'h', 'x', bag());
    expect(refused.ok).toBe(false);
    expect(state.log).toEqual([]);
    const opened = openInSpace(space(), state, 'h', 'x', bag());
    expect(opened.ok).toBe(true);
    expect(state.log).toEqual(['rolled', 'applied']);
  });

  it('stored contents are used and never rolled', () => {
    const state = { ...base(), container: chest({ contents: [[BOTTLE]] }) };
    openInSpace(space(), state, 'h', 'x', bag());
    expect(state.log).toEqual(['applied']);
  });

  it('the price is checked after the room check and charged before the space applies', () => {
    const state = base();
    const order: string[] = [];
    const price = {
      check: () => {
        order.push('check');
        return null;
      },
      spend: (): DomainEvent[] => {
        order.push('spend');
        return [{ type: 'PAID', payload: {} }];
      },
    };
    const opened = openInSpace(space(), state, 'h', 'x', bag(), price);
    expect(order).toEqual(['check', 'spend']);
    expect(opened).toEqual({
      ok: true,
      events: [
        { type: 'PAID', payload: {} },
        { type: 'OPENED', payload: {} },
      ],
    });
  });

  it('a refused price returns its events, applies nothing and charges nothing', () => {
    const state = base();
    const spent: string[] = [];
    const price = {
      check: (): DomainEvent[] => [{ type: 'POOR', payload: {} }],
      spend: (): DomainEvent[] => {
        spent.push('x');
        return [];
      },
    };
    expect(openInSpace(space(), state, 'h', 'x', bag(), price)).toEqual({
      ok: false,
      reason: null,
      events: [{ type: 'POOR', payload: {} }],
    });
    expect(spent).toEqual([]);
    expect(state.log).toEqual(['rolled']);
  });

  it('a room refusal comes before the price: no room and no money is NO_ROOM_FOR_LOOT', () => {
    const crowded = { ...space(), neighbours: () => ring(0) };
    const state = { ...base(), container: chest({ contents: [[BOTTLE]] }) };
    const price = { check: (): DomainEvent[] => [{ type: 'POOR', payload: {} }], spend: () => [] };
    expect(openInSpace(crowded, state, 'h', 'x', bag(), price)).toMatchObject({
      reason: 'NO_ROOM_FOR_LOOT',
    });
  });
});
