import { Container, Graphics, Text } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';

export interface CombatMarkerEntry {
  key: string;
  owner: 'hero' | 'enemy';
  coord: IHexCoordinates;
}

export interface CombatMarkerLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface CombatMarkerLayer {
  syncMarkers(markers: CombatMarkerEntry[]): void;
  destroy(): void;
}

export function createCombatMarkerLayer(deps: CombatMarkerLayerDeps): CombatMarkerLayer {
  const container = new Container();
  deps.worldContainer.addChild(container);

  const pool: Array<{ root: Container; box: Graphics; text: Text }> = [];

  function getNode(index: number) {
    let node = pool[index];
    if (!node) {
      const root = new Container();
      const box = new Graphics();
      const text = new Text({
        text: '✖',
        style: { fontFamily: 'Cinzel, serif', fontSize: 18, fill: 0xff7e7e },
      });
      text.anchor.set(0.5);
      root.addChild(box, text);
      container.addChild(root);
      node = { root, box, text };
      pool[index] = node;
    }
    return node;
  }

  function syncMarkers(markers: CombatMarkerEntry[]) {
    const { w, h } = deps.getTileSize();

    markers.forEach((marker, index) => {
      const node = getNode(index);
      node.root.visible = true;

      const { x, y } = calcHexPixelPosition({ coordinates: marker.coord }, w, h);
      node.root.position.set(x + w / 2, y + h / 2);

      node.box.clear();
      node.box
        .roundRect(-w * 0.32, -h * 0.32, w * 0.64, h * 0.64, 6)
        .fill({ color: 0x300a0a, alpha: 0.94 })
        .stroke({ color: 0xff5050, width: 2, alpha: 0.4 });
    });

    for (let i = markers.length; i < pool.length; i++) {
      pool[i].root.visible = false;
    }
  }

  return {
    syncMarkers,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
