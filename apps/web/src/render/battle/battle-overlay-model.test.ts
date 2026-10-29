import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { battleItem, enemyCreature } from '@hexoflat/engine/battle/battle-catalogue';
import type {
  BattleCreature,
  BattleState,
  BattleTerrain,
} from '@hexoflat/engine/battle/battle-state';
import { projectBattleForViewer } from '@hexoflat/engine/battle/projection';
import { startBattle } from '@hexoflat/engine/battle/start-battle';
import { beginTurn } from '@hexoflat/engine/battle/turn';
import { devBattleHero } from '@/a-game-scenes/battle-scene/dev-battlefield';
import { battleOverlayModel, type BattleOverlayInput } from './battle-overlay-model';

function board(overrides: Record<string, BattleTerrain> = {}): Record<string, BattleTerrain> {
  const tiles: Record<string, BattleTerrain> = {};
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) if (Math.abs(q + r) <= 3) tiles[`${q},${r}`] = 'floor';
  }
  return { ...tiles, ...overrides };
}

function heroTurn(
  creatures: BattleCreature[],
  terrain: Record<string, BattleTerrain> = {},
): BattleState {
  const battle = startBattle({ id: 'b', seed: 's', board: board(terrain), creatures }).battle;
  battle.order = creatures.map((c) => c.id);
  battle.turnIndex = 0;
  beginTurn(battle, creatures[0].id, BATTLE_RULES);
  return battle;
}

function model(battle: BattleState, patch: Partial<BattleOverlayInput> = {}) {
  return battleOverlayModel({
    projection: projectBattleForViewer(battle, 'heroes'),
    zones: null,
    mode: null,
    results: [],
    ...patch,
  });
}

const hero = () => ({ ...devBattleHero('h'), pos: { q: 0, r: 0 } });

describe('battle overlay model', () => {
  it('puts no price or reachable marks on the board in move mode', () => {
    const battle = heroTurn([hero(), enemyCreature('skeleton-warrior', 'w', { q: 3, r: -3 })], {
      '1,0': 'saw',
    });
    expect(model(battle, { mode: 'move' }).marks).toEqual([]);
  });

  it('marks only the foes a strike, push or pull can reach', () => {
    const battle = heroTurn([
      hero(),
      enemyCreature('skeleton-warrior', 'near', { q: 1, r: 0 }),
      enemyCreature('skeleton-warrior', 'two', { q: -2, r: 0 }),
      enemyCreature('skeleton-king', 'king', { q: 0, r: 1 }),
    ]);
    const targets = (mode: 'strike' | 'push' | 'pull') =>
      model(battle, { mode })
        .marks.filter((m) => m.tone === 'target')
        .map((m) => `${m.hex.q},${m.hex.r}`);
    expect(targets('strike').sort()).toEqual(['0,1', '1,0']);
    expect(targets('push')).toEqual(['1,0']);
    expect(targets('pull')).toEqual(['-2,0']);
  });

  it('shows the ring of a strike waiting on the hero, placed shields and a ×N badge', () => {
    const battle = heroTurn([hero(), enemyCreature('skeleton-warrior', 'w', { q: 2, r: 0 })]);
    battle.pending = [
      {
        id: 'p1',
        attackerId: 'w',
        targetId: 'h',
        fromHex: { q: 1, r: 0 },
        ring: [
          { q: 1, r: 0 },
          { q: 0, r: 1 },
        ],
        power: 1,
      },
      {
        id: 'p2',
        attackerId: 'w',
        targetId: 'h',
        fromHex: { q: 0, r: 1 },
        ring: [{ q: 0, r: 1 }],
        power: 1,
      },
    ];
    battle.placedShields = [{ q: 0, r: 1 }];
    const { marks, badges } = model(battle);
    expect(marks.filter((m) => m.tone === 'ring')).toHaveLength(3);
    expect(marks).toContainEqual({ hex: { q: 0, r: 1 }, tone: 'shield' });
    expect(badges).toEqual([{ hex: { q: 0, r: 0 }, text: '×2' }]);
  });

  it('draws deployment zones and defend results, and nothing for the enemy turn', () => {
    const battle = heroTurn([enemyCreature('skeleton-warrior', 'w', { q: 2, r: 0 }), hero()]);
    const { marks } = model(battle, {
      mode: 'move',
      zones: { heroes: [{ q: -3, r: 0 }], enemies: [{ q: 3, r: 0 }] },
      results: [{ fromHex: { q: 1, r: 0 }, outcome: 'blocked' }],
    });
    expect(marks.map((m) => m.tone).sort()).toEqual(['blocked', 'enemyZone', 'heroZone']);
  });

  it('keeps the hidden side of an enemy strike out of the overlay', () => {
    const battle = heroTurn([hero(), enemyCreature('skeleton-warrior', 'w', { q: 2, r: 0 })]);
    battle.pending = [
      {
        id: 'p',
        attackerId: 'w',
        targetId: 'h',
        fromHex: { q: 1, r: 0 },
        ring: [
          { q: 1, r: 0 },
          { q: 0, r: 1 },
        ],
        power: 1,
      },
    ];
    const twin = structuredClone(battle);
    twin.pending[0].fromHex = { q: 0, r: 1 };
    expect(model(battle)).toEqual(model(twin));
  });

  it('uses the bow range for an archer hero', () => {
    const archer = { ...hero(), hands: { right: battleItem('bone-bow'), left: null } };
    const battle = heroTurn([
      archer,
      enemyCreature('skeleton-warrior', 'adj', { q: 1, r: 0 }),
      enemyCreature('skeleton-warrior', 'far', { q: -3, r: 0 }),
    ]);
    const targets = model(battle, { mode: 'strike' }).marks.filter((m) => m.tone === 'target');
    expect(targets.map((m) => m.hex)).toEqual([{ q: -3, r: 0 }]);
  });
});
