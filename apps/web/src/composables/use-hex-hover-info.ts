import { shallowRef } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';

export interface HexHoverAnchor {
  centerX: number;
  top: number;
  bottom: number;
}

export interface HexHoverTarget {
  coordinates: IHexCoordinates;
  anchor: HexHoverAnchor;
}

const hexHoverTarget = shallowRef<HexHoverTarget | null>(null);

export function useHexHoverInfo() {
  function show(coordinates: IHexCoordinates, anchor: HexHoverAnchor) {
    hexHoverTarget.value = { coordinates, anchor };
  }

  function move(anchor: HexHoverAnchor) {
    const current = hexHoverTarget.value;
    if (current) hexHoverTarget.value = { ...current, anchor };
  }

  function hide() {
    hexHoverTarget.value = null;
  }

  return { target: hexHoverTarget, show, move, hide };
}
