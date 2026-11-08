import { describe, expect, it } from 'vitest';
import { battleItem, enemyCreature } from '@hexoflat/engine/battle/battle-catalogue';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { buildBattleHexInfo, type BattleHexInfoScene } from './build-battle-hex-info';

const t = (key: string) => key;
const te = () => false;

const hero: BattleCreature = {
  id: 'hero-1',
  side: 'heroes',
  kind: 'hero',
  pos: { q: 0, r: 0 },
  hp: 6,
  maxHp: 6,
  weight: 1,
  force: 1,
  hands: { right: battleItem('sword'), left: battleItem('wooden-shield') },
  bag: [],
};

const warrior = enemyCreature('skeleton-warrior', 'skeleton-warrior-1', { q: 1, r: 0 });
const king = enemyCreature('skeleton-king', 'skeleton-king-1', { q: 2, r: 0 });

const scene: BattleHexInfoScene = {
  board: { '0,0': 'floor', '1,0': 'floor', '2,0': 'floor', '3,0': 'wall', '4,0': 'saw' },
  boulders: [{ id: 'b1', pos: { q: 5, r: 0 } }],
  creatures: [hero, warrior, king],
};

function infoAt(q: number, r: number, over = scene) {
  return buildBattleHexInfo({ q, r }, over, t, te);
}

describe('buildBattleHexInfo', () => {
  it('shows no card over a creature, the hero board and the enemy list have its details', () => {
    expect(infoAt(0, 0)).toBeNull();
    expect(infoAt(1, 0)).toBeNull();
    expect(infoAt(2, 0)).toBeNull();
  });

  it('shows the terrain again once the creature on it has fallen', () => {
    const fallen = {
      ...scene,
      board: { ...scene.board, '0,0': 'saw' as const },
      creatures: [{ ...hero, hp: 0 }],
    };
    expect(infoAt(0, 0, fallen)?.title).toBe('content.battle.saw.title');
  });

  it('describes walls, saws and boulders from the battle content', () => {
    expect(infoAt(3, 0)).toMatchObject({ title: 'content.battle.wall.title', icon: 'tower' });
    expect(infoAt(4, 0)).toMatchObject({ title: 'content.battle.saw.title', icon: 'tower' });
    expect(infoAt(5, 0)).toMatchObject({ title: 'content.battle.boulder.title' });
    expect(infoAt(3, 0)?.description).toBe('content.battle.wall.tableRule');
  });

  it('shows the saw as a construction with a short warning and one short hint', () => {
    const view = infoAt(4, 0);
    expect(view).toMatchObject({
      variant: 'construction',
      description: 'hexInfo.hints.saw',
      effect: { label: 'hexInfo.effects.sawHurts' },
      hearts: null,
    });
  });

  it('shows nothing for a bare floor or a hex off the board', () => {
    expect(infoAt(0, 5)).toBeNull();
    expect(infoAt(9, 9)).toBeNull();
  });
});
