import { Container, Sprite, type FederatedPointerEvent, type Ticker } from 'pixi.js';
import type { BattleHex, BattleTerrain, Boulder } from '@hexoflat/engine/battle/battle-state';
import type { BattlefieldBiome } from '@hexoflat/engine/battle/battlefield';
import { hexKey, parseHexKey } from '@hexoflat/engine/battle/hex-battle-geom';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { TileAnchor } from '@/render/layers/tiles-layer';
import { createHexHitArea, createHexMask } from '@/render/hex-geometry';
import { applyObjectFit } from '@/render/object-fit';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import {
  BATTLE_TERRAIN_TOKENS,
  SAW_SPIN_RADIANS_PER_SECOND,
  battleFloorSprite,
  battleObjectSprite,
} from '@/render/battle/battle-look';

export interface BattleLayerDeps {
  worldContainer: Container;
  ticker: Ticker;
  tileSize: { w: number; h: number };
  positionOf(hex: BattleHex): { x: number; y: number };
  onHexTap?: (hex: BattleHex) => void;
  onHexHover?: (hex: BattleHex) => void;
  onHexPointer?: (hex: BattleHex | null, anchor: TileAnchor | null) => void;
}

export interface BattleBoardSyncParams {
  biome: BattlefieldBiome;
  board: Record<string, BattleTerrain>;
  boulders: Boulder[];
}

export interface BattleBoardLayer {
  sync(params: BattleBoardSyncParams): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

type Fit = (sprite: Sprite) => void;

export function createBattleBoardLayer(deps: BattleLayerDeps): BattleBoardLayer {
  const { w, h } = deps.tileSize;
  const container = new Container();
  deps.worldContainer.addChild(container);
  let blades: Sprite[] = [];
  let unsubscribers: Array<() => void> = [];

  const coverTile: Fit = (sprite) => applyObjectFit(sprite, w, h, EHexobjectGroup.CONSTRUCTION);
  const spinningTile: Fit = (sprite) => {
    sprite.anchor.set(0);
    coverTile(sprite);
    const { x, y } = sprite.position;
    sprite.anchor.set(0.5);
    sprite.position.set(x + sprite.width / 2, y + sprite.height / 2);
  };

  function textured(path: string, fit: Fit): Sprite {
    const sprite = new Sprite(getTexture(path));
    fit(sprite);
    unsubscribers.push(
      onTextureReady(path, () => {
        sprite.texture = getTexture(path);
        fit(sprite);
      }),
    );
    return sprite;
  }

  const spin = (ticker: Ticker) => {
    const step = (SAW_SPIN_RADIANS_PER_SECOND * ticker.deltaMS) / 1000;
    for (const blade of blades) blade.rotation += step;
  };

  function setSpinning(on: boolean) {
    deps.ticker.remove(spin);
    if (on && blades.length) deps.ticker.add(spin);
  }

  function anchorOf(tile: Container, event: FederatedPointerEvent): TileAnchor {
    const offsetX = event.clientX - event.global.x;
    const offsetY = event.clientY - event.global.y;
    const top = tile.toGlobal({ x: w / 2, y: 0 });
    const bottom = tile.toGlobal({ x: w / 2, y: h });
    return { centerX: top.x + offsetX, top: top.y + offsetY, bottom: bottom.y + offsetY };
  }

  function tileAt(hex: BattleHex, layers: Sprite[]): Container {
    const tile = new Container();
    const mask = createHexMask(w, h);
    tile.addChild(mask, ...layers);
    tile.mask = mask;
    const { x, y } = deps.positionOf(hex);
    tile.position.set(x, y);
    if (deps.onHexTap) {
      tile.eventMode = 'static';
      tile.hitArea = createHexHitArea(w, h);
      tile.on('pointertap', () => deps.onHexTap?.(hex));
      tile.on('pointerover', (event) => {
        deps.onHexHover?.(hex);
        deps.onHexPointer?.(hex, anchorOf(tile, event));
      });
      tile.on('pointermove', (event) => deps.onHexPointer?.(hex, anchorOf(tile, event)));
      tile.on('pointerout', () => deps.onHexPointer?.(null, null));
    }
    return tile;
  }

  function drawTile(floor: string, terrain: BattleTerrain, boulder: boolean): Sprite[] {
    const layers = [textured(floor, coverTile)];
    if (terrain === 'wall') layers.push(textured(battleObjectSprite('wall'), coverTile));
    const token = BATTLE_TERRAIN_TOKENS[terrain];
    if (token) {
      const sprite = textured(token, terrain === 'saw' ? spinningTile : coverTile);
      if (terrain === 'saw') blades.push(sprite);
      layers.push(sprite);
    }
    if (boulder) layers.push(textured(battleObjectSprite('boulder'), coverTile));
    return layers;
  }

  function clear() {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    blades = [];
    container.removeChildren().forEach((child) => child.destroy({ children: true }));
  }

  function sync({ biome, board, boulders }: BattleBoardSyncParams) {
    clear();
    const floor = battleFloorSprite(biome);
    const boulderKeys = new Set(boulders.map((b) => hexKey(b.pos)));
    for (const [key, terrain] of Object.entries(board)) {
      const hex = parseHexKey(key);
      const layers = drawTile(floor, terrain, boulderKeys.has(key));
      container.addChild(tileAt(hex, layers));
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
      clear();
      container.destroy({ children: true });
    },
  };
}
