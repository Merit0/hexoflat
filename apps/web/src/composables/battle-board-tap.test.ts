import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { enemyCreature } from '@hexoflat/engine/battle/battle-catalogue';
import type {
  BattleCreature,
  BattleHex,
  BattleState,
  BattleTerrain,
} from '@hexoflat/engine/battle/battle-state';
import { projectBattleForViewer } from '@hexoflat/engine/battle/projection';
import { startBattle } from '@hexoflat/engine/battle/start-battle';
import { beginTurn } from '@hexoflat/engine/battle/turn';
import { devBattleHero } from '@/a-game-scenes/battle-scene/dev-battlefield';
import { battleMovePreview, type BattleUiMode } from './battle-board-tap';

function board(overrides: Record<string, BattleTerrain> = {}): Record<string, BattleTerrain> {
  const tiles: Record<string, BattleTerrain> = {};
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) if (Math.abs(q + r) <= 3) tiles[`${q},${r}`] = 'floor';
  }
  return { ...tiles, ...overrides };
}

function heroTurn(terrain: Record<string, BattleTerrain> = {}, will?: number): BattleState {
  const creatures: BattleCreature[] = [
    { ...devBattleHero('h'), pos: { q: 0, r: 0 } },
    enemyCreature('skeleton-warrior', 'w', { q: 3, r: -3 }),
  ];
  const battle = startBattle({ id: 'b', seed: 's', board: board(terrain), creatures }).battle;
  battle.order = creatures.map((c) => c.id);
  battle.turnIndex = 0;
  beginTurn(battle, 'h', BATTLE_RULES);
  battle.phase = 'act';
  if (will !== undefined) battle.turnWill = will;
  return battle;
}

function preview(battle: BattleState, hex: BattleHex, mode: BattleUiMode = 'move') {
  return battleMovePreview({
    projection: projectBattleForViewer(battle, 'heroes'),
    localHeroIds: ['h'],
    mode,
    hex,
    rules: BATTLE_RULES,
  });
}

describe('battleMovePreview', () => {
  it('returns the cheapest path and its total Will cost to the hovered hex', () => {
    const result = preview(heroTurn(), { q: 2, r: 0 });
    expect(result?.path).toEqual([
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ]);
    expect(result?.cost).toBe(2 * BATTLE_RULES.step.floor);
    expect(result?.reachable).toBe(true);
  });

  it('still shows a path the hero cannot afford, marked unreachable', () => {
    const result = preview(heroTurn({}, 1), { q: 2, r: 0 });
    expect(result?.path).toHaveLength(2);
    expect(result?.reachable).toBe(false);
  });

  it('ends a path on a saw but never walks through one', () => {
    const result = preview(heroTurn({ '1,0': 'saw' }), { q: 1, r: 0 });
    expect(result?.path).toEqual([{ q: 1, r: 0 }]);
    const around = preview(heroTurn({ '1,0': 'saw' }), { q: 2, r: 0 });
    expect(around?.path.some((h) => h.q === 1 && h.r === 0)).toBe(false);
  });

  it('shows nothing on the hero hex, outside move mode, or on a foe', () => {
    expect(preview(heroTurn(), { q: 0, r: 0 })).toBeNull();
    expect(preview(heroTurn(), { q: 1, r: 0 }, 'strike')).toBeNull();
    expect(preview(heroTurn(), { q: 3, r: -3 })).toBeNull();
  });
});
