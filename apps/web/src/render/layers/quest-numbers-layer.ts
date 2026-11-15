import { CREATURE_SPRITES } from '@/render/creature-sprites';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { getPrototype } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { QuestFieldModel } from '@/services/quests/quest-field-model';
import type { TileAnchor } from '@/render/layers/tiles-layer';
import { createHexHitArea, createHexMask } from '@/render/hex-geometry';
import { applyObjectFit } from '@/render/object-fit';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import { hiddenTileLook } from '@/render/fog-look';

export const QUEST_CHEST_SPRITE = '/hex-assets/hex-loot/chest-token.png';

export interface QuestLayerDeps {
  worldContainer: Container;
  tileSize: { w: number; h: number };
  positionOf(hex: IHexCoordinates): { x: number; y: number };
  floorSprite: string;
  isHidden?(key: string): boolean;
  onHexTap?: (hex: IHexCoordinates) => void;
  onHexPointer?: (hex: IHexCoordinates | null, anchor: TileAnchor | null) => void;
}

export interface QuestNumbersLayer {
  sync(model: QuestFieldModel): void;
  resync(): void;
  destroy(): void;
}

const HINT_GREEN = 0x6fdc8c;
export const EMPTY_CHEST_ALPHA = 0.45;

export function questLayerAssetPaths(floorSprite: string): string[] {
  return [
    floorSprite,
    '/hex-assets/hex-constructs/camping-door-hex.png',
    QUEST_CHEST_SPRITE,
    CREATURE_SPRITES.hero,
    hiddenTileLook('mist').url,
  ];
}

export function createQuestNumbersLayer(deps: QuestLayerDeps): QuestNumbersLayer {
  const { w, h } = deps.tileSize;
  const root = new Container();
  deps.worldContainer.addChild(root);
  const tiles = new Container();
  const marks = new Container();
  root.addChild(tiles, marks);
  let unsubscribers: Array<() => void> = [];

  function textured(url: string, group = EHexobjectGroup.CONSTRUCTION): Sprite {
    const sprite = new Sprite(getTexture(url));
    applyObjectFit(sprite, w, h, group);
    unsubscribers.push(
      onTextureReady(url, () => {
        sprite.texture = getTexture(url);
        applyObjectFit(sprite, w, h, group);
      }),
    );
    return sprite;
  }

  function anchorOf(tile: Container, clientX: number, clientY: number, gx: number, gy: number) {
    const top = tile.toGlobal({ x: w / 2, y: 0 });
    const bottom = tile.toGlobal({ x: w / 2, y: h });
    const dx = clientX - gx;
    const dy = clientY - gy;
    return { centerX: top.x + dx, top: top.y + dy, bottom: bottom.y + dy } satisfies TileAnchor;
  }

  function tileAt(hex: IHexCoordinates, content: Container[], interactive: boolean): Container {
    const tile = new Container();
    const mask = createHexMask(w, h);
    tile.addChild(mask, ...content);
    tile.mask = mask;
    const { x, y } = deps.positionOf(hex);
    tile.position.set(x, y);
    if (interactive) {
      tile.eventMode = 'static';
      tile.hitArea = createHexHitArea(w, h);
      tile.on('pointertap', () => deps.onHexTap?.(hex));
      const report = (event: {
        clientX: number;
        clientY: number;
        global: { x: number; y: number };
      }) =>
        deps.onHexPointer?.(
          hex,
          anchorOf(tile, event.clientX, event.clientY, event.global.x, event.global.y),
        );
      tile.on('pointerover', report);
      tile.on('pointermove', report);
      tile.on('pointerout', () => deps.onHexPointer?.(null, null));
    }
    return tile;
  }

  function numberText(value: number, hint: boolean): Text {
    const text = new Text({
      text: String(value),
      style: {
        fontFamily: 'Cinzel, serif',
        fontSize: Math.round(h * 0.34),
        fontWeight: '800',
        fill: hint ? 0x06260f : 0xf5fcff,
        stroke: { color: hint ? HINT_GREEN : 0x0b0d11, width: 5 },
      },
    });
    text.anchor.set(0.5);
    text.position.set(w / 2, h / 2);
    return text;
  }

  function footprints(): Graphics {
    const g = new Graphics();
    g.ellipse(w * 0.4, h * 0.42, w * 0.07, h * 0.1).fill({ color: 0xffffff, alpha: 0.35 });
    g.ellipse(w * 0.6, h * 0.58, w * 0.07, h * 0.1).fill({ color: 0xffffff, alpha: 0.35 });
    return g;
  }

  function stackSprite(itemKey: string, amount: number): Container[] {
    const meta = getPrototype(itemKey as THexobjectKey);
    const parts: Container[] = [];
    if (meta?.spritePath) parts.push(textured(meta.spritePath, meta.groupType));
    if (amount > 1) {
      const count = new Text({
        text: String(amount),
        style: {
          fontFamily: 'Cinzel, serif',
          fontSize: Math.round(h * 0.2),
          fontWeight: '800',
          fill: 0xf5fcff,
          stroke: { color: 0x0b0d11, width: 4 },
        },
      });
      count.anchor.set(1, 1);
      count.position.set(w * 0.82, h * 0.86);
      parts.push(count);
    }
    return parts;
  }

  function clear() {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    tiles.removeChildren().forEach((child) => child.destroy({ children: true }));
    marks.removeChildren().forEach((child) => child.destroy({ children: true }));
  }

  let last: QuestFieldModel | null = null;

  function sync(model: QuestFieldModel) {
    last = model;
    clear();
    const mist = hiddenTileLook('mist').url;
    for (const hex of model.fog) tiles.addChild(tileAt(hex, [textured(mist)], false));
    for (const cell of model.hexes) {
      const content: Container[] = [textured(deps.floorSprite)];
      if (cell.footprint) content.push(footprints());
      if (cell.number !== null && cell.step === null)
        content.push(numberText(cell.number, cell.hint));
      if (cell.step) {
        if (cell.number !== null) content.push(numberText(cell.number, cell.hint));
      }
      const tile = tileAt(cell.hex, content, cell.step !== null);
      tiles.addChild(tile);
    }
    if (model.exit)
      marks.addChild(
        tileAt(model.exit, [textured('/hex-assets/hex-constructs/camping-door-hex.png')], true),
      );
    if (model.chest) {
      const chest = textured(QUEST_CHEST_SPRITE, EHexobjectGroup.LOOT);
      if (model.chestEmpty) chest.alpha = EMPTY_CHEST_ALPHA;
      marks.addChild(tileAt(model.chest, [chest], model.walking || model.collect));
    }
    for (const stack of model.ground) {
      if (deps.isHidden?.(coordinateKey(stack.hex))) continue;
      marks.addChild(tileAt(stack.hex, stackSprite(stack.itemKey, stack.amount), model.collect));
    }
  }

  return {
    sync,
    resync() {
      if (last) sync(last);
    },
    destroy() {
      clear();
      root.destroy({ children: true });
    },
  };
}
