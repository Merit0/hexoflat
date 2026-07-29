import { Container, Graphics, Text } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { buildHexPolygon } from '@/render/hex-geometry';

export interface MovePreviewLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface MovePreviewSyncParams {
  segments: IHexCoordinates[];
  reachable: boolean;
  markerCoord: IHexCoordinates | null;
  stepCost: number;
  markerKind: 'move' | 'defend';
}

export interface MovePreviewLayer {
  sync(params: MovePreviewSyncParams): void;
  destroy(): void;
}

const REACHABLE_FILL = 0x67ff9d;
const UNREACHABLE_FILL = 0xff6c6c;

export function createMovePreviewLayer(deps: MovePreviewLayerDeps): MovePreviewLayer {
  const container = new Container();
  deps.worldContainer.addChild(container);

  const segmentPool: Graphics[] = [];
  const marker = new Container();
  const markerCircle = new Graphics();
  const markerText = new Text({
    text: '',
    style: { fontFamily: 'Cinzel, serif', fontSize: 12, fontWeight: '800', fill: 0xf5fcff },
  });
  markerText.anchor.set(0.5);
  marker.addChild(markerCircle, markerText);
  marker.visible = false;
  container.addChild(marker);

  function getSegmentGraphic(index: number): Graphics {
    let g = segmentPool[index];
    if (!g) {
      g = new Graphics();
      segmentPool[index] = g;
      container.addChildAt(g, index);
    }
    return g;
  }

  function sync(params: MovePreviewSyncParams) {
    const { w, h } = deps.getTileSize();
    const fillColor = params.reachable ? REACHABLE_FILL : UNREACHABLE_FILL;

    params.segments.forEach((coord, index) => {
      const g = getSegmentGraphic(index);
      const { x, y } = calcHexPixelPosition({ coordinates: coord }, w, h);
      g.position.set(x, y);
      g.clear();
      g.poly(buildHexPolygon(w, h).points).fill({ color: fillColor, alpha: 0.16 });
    });

    for (let i = params.segments.length; i < segmentPool.length; i++) {
      segmentPool[i].clear();
    }

    if (!params.markerCoord) {
      marker.visible = false;
      return;
    }

    marker.visible = true;
    const { x, y } = calcHexPixelPosition({ coordinates: params.markerCoord }, w, h);
    marker.position.set(x + w / 2, y + h / 2);

    const isDefend = params.markerKind === 'defend';
    const strokeColor = isDefend ? 0x84bcff : params.reachable ? 0x84ffb8 : 0xff7e7e;
    const circleFill = isDefend ? 0x5ca0ff : params.reachable ? 0x60ffa4 : 0xff6464;

    markerCircle.clear();
    markerCircle
      .circle(0, 0, 13)
      .fill({ color: circleFill, alpha: isDefend ? 0.18 : params.reachable ? 0.16 : 0.14 })
      .stroke({ color: strokeColor, width: 2 });

    markerText.text = isDefend ? '🛡' : String(params.stepCost);
    markerText.style.fontSize = isDefend ? 16 : 12;
  }

  return {
    sync,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
