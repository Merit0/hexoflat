import { describe, expect, it, vi } from 'vitest';
import { Container } from 'pixi.js';
import { enemyCreature } from '@hexoflat/engine/battle/battle-catalogue';
import { createBattleTokenLayer } from './battle-token-layer';

vi.mock('@/render/texture-cache', async () => {
  const { Texture } = await import('pixi.js');
  return { getTexture: () => Texture.EMPTY, onTextureReady: () => () => {} };
});

function layerOn(world: Container) {
  return createBattleTokenLayer({
    worldContainer: world,
    tileSize: { w: 60, h: 60 },
    positionOf: (hex: { q: number; r: number }) => ({ x: hex.q * 60, y: hex.r * 60 }),
  });
}

function gravesOf(world: Container): Container {
  return world.children[0].children[0];
}

describe('REQ-LOOT-102 graves come from the battle state', () => {
  const dead = { ...enemyCreature('skeleton-warrior', 'w', { q: 1, r: 0 }), hp: 0 };

  it('draws one grave per grave in state, not a second one for the dead creature', () => {
    const world = new Container();
    const layer = layerOn(world);
    layer.sync([dead], null, [], [{ hex: { q: 1, r: 0 }, examined: false }]);
    expect(gravesOf(world).children).toHaveLength(1);
  });

  it('draws the examined grave at 0.45 opacity', () => {
    const world = new Container();
    const layer = layerOn(world);
    layer.sync([dead], null, [], [{ hex: { q: 1, r: 0 }, examined: true }]);
    expect(gravesOf(world).children[0].alpha).toBe(0.45);
  });

  it('keeps the old creature grave while the fight lasts (no collect state)', () => {
    const world = new Container();
    const layer = layerOn(world);
    layer.sync([dead], null, []);
    expect(gravesOf(world).children).toHaveLength(1);
    expect(gravesOf(world).children[0].alpha).toBe(1);
  });

  it('holds back the grave while the creature is still falling', () => {
    const world = new Container();
    const layer = layerOn(world);
    layer.setDying(new Set(['w']));
    layer.sync([dead], null, [], [{ hex: { q: 1, r: 0 }, examined: false }]);
    expect(gravesOf(world).children).toHaveLength(0);
    layer.setDying(new Set());
    expect(gravesOf(world).children).toHaveLength(1);
  });
});
