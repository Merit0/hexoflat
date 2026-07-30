import { Container, Graphics, Text } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { buildHexPolygon } from '@/render/hex-geometry';

export interface CampHealLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface CampHealSyncParams {
  coord: IHexCoordinates | null;
  active: boolean;
  label: string;
}

export interface CampHealLayer {
  sync(params: CampHealSyncParams): void;
  destroy(): void;
}

export function createCampHealLayer(deps: CampHealLayerDeps): CampHealLayer {
  const root = new Container();
  root.visible = false;
  deps.worldContainer.addChild(root);

  const bg = new Graphics();
  const heart = new Text({
    text: '♥',
    style: { fontFamily: 'Cinzel, serif', fontSize: 24, fill: 0xff6076 },
  });
  heart.anchor.set(0.5);

  const labelBg = new Graphics();
  const label = new Text({
    text: '',
    style: { fontFamily: 'Cinzel, serif', fontSize: 10, fontWeight: '700', fill: 0xecf8ef },
  });
  label.anchor.set(0.5);

  root.addChild(bg, heart, labelBg, label);

  function sync(params: CampHealSyncParams) {
    root.visible = !!params.coord;
    if (!params.coord) return;

    const { w, h } = deps.getTileSize();
    const { x, y } = calcHexPixelPosition({ coordinates: params.coord }, w, h);
    root.position.set(x + w / 2, y + h / 2);

    bg.clear();
    const polygon = buildHexPolygon(w, h);
    const offsetPoints = polygon.points.map((p, i) => (i % 2 === 0 ? p - w / 2 : p - h / 2));
    bg.poly(offsetPoints).fill({
      color: params.active ? 0x84de9c : 0xa6d6b2,
      alpha: params.active ? 0.24 : 0.14,
    });

    heart.style.fill = params.active ? 0xff6076 : 0xe4ecf4;
    heart.alpha = params.active ? 0.96 : 0.78;
    heart.position.set(0, -h * 0.06);

    label.text = params.label;
    label.position.set(0, h * 0.34);

    const labelWidth = label.width + 12;
    const labelHeight = label.height + 4;
    labelBg.clear();
    labelBg
      .roundRect(-labelWidth / 2, h * 0.34 - labelHeight / 2, labelWidth, labelHeight, 999)
      .fill({ color: 0x080e0a, alpha: 0.72 });
  }

  return {
    sync,
    destroy() {
      root.destroy({ children: true });
    },
  };
}
