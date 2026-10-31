import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { enemyCreature } from './battle-catalogue';
import type { BattleCreature, BattleHex, BattleState, BattleTerrain } from './battle-state';
import { battleDistance } from './hex-battle-geom';
import {
  battleWith,
  enemyTurn,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  hexagonBoard,
  rejectionOf,
  strikeOpened,
} from './battle-test-setup';
import { nextEnemyAction } from './ai/enemy-ai';
import { projectBattleForViewer } from './projection';

function enemyFirst(
  creatures: BattleCreature[],
  terrain: Record<string, BattleTerrain> = {},
): BattleState {
  const enemy = creatures.find((c) => c.side === 'enemies')!;
  return giveTurn(battleWith(creatures, hexagonBoard(4, terrain)), [
    enemy.id,
    ...creatures.filter((c) => c !== enemy).map((c) => c.id),
  ]);
}

function decide(battle: BattleState) {
  return nextEnemyAction(projectBattleForViewer(battle, 'enemies'), BATTLE_RULES);
}

function moves(events: { type: string; payload: unknown }[]) {
  return events
    .filter((e) => e.type === 'CREATURE_MOVED')
    .map((e) => (e.payload as { to: unknown }).to);
}

describe('REQ-BTL-010 archer', () => {
  const archer = (pos = { q: 3, r: 0 }) => enemyCreature('skeleton-archer', 'a1', pos);

  it('shoots from two or three hexes, with an arc of three hexes facing the archer', () => {
    const battle = enemyFirst([hero({ q: 0, r: 0 }), archer({ q: 3, r: 0 })]);
    const { battle: after } = enemyTurn(battle);
    const strike = after.pending[0];
    expect(strike.ring).toHaveLength(3);
    expect(strike.ring).toContainEqual({ q: 1, r: 0 });
    expect(strike.fromHex).toEqual({ q: 1, r: 0 });
  });

  it('walks into range before shooting, keeping Will for the shot', () => {
    const { battle, events } = enemyTurn(
      enemyFirst([hero({ q: -2, r: 0 }), archer({ q: 4, r: 0 })]),
    );
    expect(moves(events).length).toBeGreaterThan(0);
    expect(eventTypes(events)).toContain('STRIKE_DEALT');
    expect(battle.pending).toHaveLength(1);
  });

  it('never shoots point-blank: it steps away first', () => {
    const { events } = enemyTurn(enemyFirst([hero({ q: 0, r: 0 }), archer({ q: 1, r: 0 })]));
    expect(eventTypes(events).slice(0, 2)).toEqual(['CREATURE_MOVED', 'STRIKE_DEALT']);
    expect(battleDistance(moves(events)[0] as BattleHex, { q: 0, r: 0 })).toBe(2);
  });

  it('refuses a hero-side point-blank shot unless cornered', () => {
    const bowHero = hero({ q: 0, r: 0 }, { hands: { right: archer().hands.right, left: null } });
    const open = giveTurn(
      battleWith([bowHero, enemyCreature('skeleton-warrior', 's1', { q: 1, r: 0 })]),
      ['hero', 's1'],
    );
    expect(
      rejectionOf(heroDoes(open, { kind: 'strike', targetId: 's1', hand: 'right' }).events),
    ).toBe('TOO_CLOSE');

    const walls: Record<string, BattleTerrain> = Object.fromEntries(
      [
        [-1, 0],
        [0, -1],
        [1, -1],
        [-1, 1],
        [0, 1],
      ].map(([q, r]) => [`${q},${r}`, 'wall']),
    );
    const boxed = giveTurn(
      battleWith(
        [bowHero, enemyCreature('skeleton-warrior', 's1', { q: 1, r: 0 })],
        hexagonBoard(3, walls),
      ),
      ['hero', 's1'],
    );
    const shot = heroDoes(boxed, { kind: 'strike', targetId: 's1', hand: 'right' });
    expect(rejectionOf(shot.events)).toBeNull();
    expect(eventTypes(shot.events)).toContain('STRIKE_DEALT');
  });

  it('refuses a shot beyond three hexes', () => {
    const bowHero = hero({ q: 0, r: 0 }, { hands: { right: archer().hands.right, left: null } });
    const far = giveTurn(
      battleWith(
        [bowHero, enemyCreature('skeleton-warrior', 's1', { q: 4, r: 0 })],
        hexagonBoard(4),
      ),
      ['hero', 's1'],
    );
    expect(
      rejectionOf(heroDoes(far, { kind: 'strike', targetId: 's1', hand: 'right' }).events),
    ).toBe('OUT_OF_RANGE');
  });
});

describe('skeleton warrior (R-AI-2)', () => {
  it('walks up, strikes once, then steps away from the hero', () => {
    const struck = enemyTurn(
      enemyFirst([hero({ q: 0, r: 0 }), enemyCreature('skeleton-warrior', 's1', { q: 3, r: 0 })]),
    );
    const hit = heroDoes(struck.battle, { kind: 'take-hit' });
    const rest = enemyTurn(hit.battle);
    const types = [struck.events, hit.events, rest.events].flatMap(eventTypes);
    expect(types.filter((t) => t === 'STRIKE_DEALT')).toHaveLength(1);
    expect(types.lastIndexOf('CREATURE_MOVED')).toBeGreaterThan(types.indexOf('STRIKE_DEALT'));
    const warrior = rest.battle.creatures.find((c) => c.id === 's1')!;
    expect(battleDistance(warrior.pos, { q: 0, r: 0 })).toBeGreaterThan(1);
  });

  it('raises its shield on the ring hex nearest the hero, and the hero then picks the side', () => {
    const battle = enemyFirst([
      hero({ q: 0, r: 0 }),
      enemyCreature('skeleton-warrior', 's1', { q: 1, r: 0 }),
    ]);
    const mine = giveTurn(battle, ['hero', 's1']);
    const { battle: after, events } = heroDoes(mine, {
      kind: 'strike',
      targetId: 's1',
      hand: 'right',
    });
    expect(eventTypes(events).slice(0, 4)).toEqual([
      'STRIKE_DEALT',
      'REACTION_OPENED',
      'SHIELD_PLACED',
      'REACTION_AIMING',
    ]);
    expect(events[2].payload).toMatchObject({ hex: { q: 0, r: 0 } });
    expect(after.reaction!.stage).toBe('aim');
    const blocked = heroDoes(after, { kind: 'aim', hex: { q: 0, r: 0 } });
    expect(blocked.events.find((e) => e.type === 'STRIKES_RESOLVED')!.payload).toMatchObject({
      results: [{ outcome: 'blocked' }],
    });
  });
});

describe('skeleton king (R-AI-3)', () => {
  it('pushes an adjacent hero onto a saw behind the hero instead of striking', () => {
    const battle = enemyFirst(
      [hero({ q: 1, r: 0 }), enemyCreature('skeleton-king', 'k', { q: 0, r: 0 })],
      { '2,0': 'saw' },
    );
    const { battle: after, events } = enemyTurn(battle);
    expect(eventTypes(events)).toEqual([
      'DISPLACE_STARTED',
      'DISPLACED',
      'HAZARD_TRIGGERED',
      'TASK_ISSUED',
    ]);
    expect(after.task).toMatchObject({ kind: 'saw', creatureId: 'hero' });
    expect(after.activeId).toBe('k');
  });

  it('strikes when there is no saw behind the hero', () => {
    const { events } = enemyTurn(
      enemyFirst([hero({ q: 1, r: 0 }), enemyCreature('skeleton-king', 'k', { q: 0, r: 0 })]),
    );
    expect(eventTypes(events)).toContain('STRIKE_DEALT');
    expect(eventTypes(events)).not.toContain('DISPLACE_STARTED');
  });
});

describe('REQ-BTL-013 enemy AI reads only the projection', () => {
  it.each(['skeleton-warrior', 'skeleton-king', 'skeleton-archer'])(
    '%s decides the same whatever the hidden side is',
    (kind) => {
      const start = giveTurn(
        battleWith([hero({ q: 0, r: 0 }), enemyCreature(kind, 'e', { q: 1, r: 0 })]),
        ['hero', 'e'],
      );
      start.creatures[1].pos = { q: 2, r: 0 };
      const battle = strikeOpenedFar(start);
      const twin = structuredClone(battle);
      twin.pending[0].fromHex = { q: 3, r: 0 };
      expect(decide(battle)).toEqual(decide(twin));
    },
  );
});

function strikeOpenedFar(start: BattleState): BattleState {
  const next = structuredClone(start);
  next.creatures[1].pos = { q: 1, r: 0 };
  return strikeOpened(next, 'hero', 'e');
}
