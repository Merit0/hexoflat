import { Container, Graphics, Sprite, Text, type Ticker } from 'pixi.js';
import type { BattleHex, BattleTerrain, Boulder } from '@hexoflat/engine/battle/battle-state';
import { parseHexKey } from '@hexoflat/engine/battle/hex-battle-geom';
import { buildHexPolygon, createHexHitArea } from '@/render/hex-geometry';
import { getTexture } from '@/render/texture-cache';
import {
  BATTLE_SPRITES,
  BATTLE_TERRAIN_PAINT,
  SAW_SPIN_RADIANS_PER_SECOND,
} from '@/render/battle/battle-look';

export interface BattleLayerDeps {
  worldContainer: Container;
  ticker: Ticker;
  tileSize: { w: number; h: number };
  positionOf(hex: BattleHex): { x: number; y: number };
  onHexTap?: (hex: BattleHex) => void;
}

export interface BattleBoardSyncParams {
  board: Record<string, BattleTerrain>;
  boulders: Boulder[];
}

export interface BattleBoardLayer {
  sync(params: BattleBoardSyncParams): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

function sawBlade(radius: number): Graphics {
  const blade = new Graphics();
  const teeth = 10;
  const points: number[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.72;
    const a = (Math.PI * i) / teeth;
    points.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  blade.poly(points).fill({ color: 0xb8bcc4 }).stroke({ color: 0x5a5e66, width: 2 });
  blade.circle(0, 0, radius * 0.22).fill({ color: 0x2a2c30 });
  return blade;
}

function sprite(path: string, w: number, h: number, scale: number): Sprite {
  const s = new Sprite(getTexture(path));
  s.anchor.set(0.5);
  s.width = w * scale;
  s.height = h * scale;
  s.position.set(w / 2, h / 2);
  return s;
}

function drawTile(terrain: BattleTerrain, w: number, h: number): Container {
  const tile = new Container();
  const paint = BATTLE_TERRAIN_PAINT[terrain];
  const base = new Graphics();
  base
    .poly(buildHexPolygon(w, h).points)
    .fill({ color: paint.fill })
    .stroke({ color: paint.stroke, width: 2 });
  tile.addChild(base);
  if (terrain === 'wall')
    tile.addChild(
      sprite(BATTLE_SPRITES.stoneFloor, w, h, 1),
      sprite(BATTLE_SPRITES.rock, w, h, 0.8),
    );
  if (terrain === 'rubble') {
    const pebbles = new Graphics();
    for (const [dx, dy, r] of [
      [-0.18, -0.1, 0.07],
      [0.12, 0.05, 0.09],
      [-0.02, 0.2, 0.06],
      [0.2, -0.18, 0.05],
    ]) {
      pebbles.circle(w / 2 + dx * w, h / 2 + dy * h, r * w).fill({ color: 0x6a6052 });
    }
    tile.addChild(pebbles);
  }
  if (paint.label) {
    const label = new Text({
      text: paint.label,
      style: { fontFamily: 'Cinzel, serif', fontSize: 11, fontWeight: '700', fill: 0xd8d4e0 },
    });
    label.anchor.set(0.5);
    label.position.set(w / 2, h * 0.78);
    tile.addChild(label);
  }
  return tile;
}

export function createBattleBoardLayer(deps: BattleLayerDeps): BattleBoardLayer {
  const container = new Container();
  deps.worldContainer.addChild(container);
  let blades: Graphics[] = [];

  const spin = (ticker: Ticker) => {
    const step = (SAW_SPIN_RADIANS_PER_SECOND * ticker.deltaMS) / 1000;
    for (const blade of blades) blade.rotation += step;
  };

  function setSpinning(on: boolean) {
    deps.ticker.remove(spin);
    if (on && blades.length) deps.ticker.add(spin);
  }

  function sync({ board, boulders }: BattleBoardSyncParams) {
    const { w, h } = deps.tileSize;
    container.removeChildren().forEach((child) => child.destroy({ children: true }));
    blades = [];
    for (const [key, terrain] of Object.entries(board)) {
      const hex = parseHexKey(key);
      const tile = drawTile(terrain, w, h);
      if (terrain === 'saw') {
        const blade = sawBlade(w * 0.36);
        blade.position.set(w / 2, h / 2);
        tile.addChild(blade);
        blades.push(blade);
      }
      const { x, y } = deps.positionOf(hex);
      tile.position.set(x, y);
      if (deps.onHexTap) {
        tile.eventMode = 'static';
        tile.hitArea = createHexHitArea(w, h);
        tile.on('pointertap', () => deps.onHexTap?.(hex));
      }
      container.addChild(tile);
    }
    for (const boulder of boulders) {
      const rock = sprite(BATTLE_SPRITES.rock, w, h, 0.62);
      const { x, y } = deps.positionOf(boulder.pos);
      rock.position.set(x + w / 2, y + h / 2);
      container.addChild(rock);
    }
    setSpinning(container.visible);
  }

  return {
    sync,
    setVisible(visible: boolean) {
      container.visible = visible;
      setSpinning(visible);
    },
    destroy() {
      deps.ticker.remove(spin);
      container.destroy({ children: true });
    },
  };
}
