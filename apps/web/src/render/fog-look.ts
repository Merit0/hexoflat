import type { BoardKind } from '@hexoflat/engine/registry/board-kind';
import { assertNever } from '@hexoflat/engine/utils/assert-never';

export type FogLook = 'clouds' | 'mist';

const CLOUD_SPRITE_URL = '/hex-assets/hex-effects/cloud-hex.png';
const MIST_SPRITE_URL = '/hex-assets/hex-effects/fog-hex.png';

export type HiddenTileLook = { kind: 'texture'; url: string };

export function hiddenTileLook(look: FogLook): HiddenTileLook {
  return { kind: 'texture', url: look === 'clouds' ? CLOUD_SPRITE_URL : MIST_SPRITE_URL };
}

export function fogLookForBoardKind(kind: BoardKind | undefined): FogLook {
  switch (kind) {
    case 'DUNGEON':
      return 'mist';
    case 'STATIC':
    case undefined:
      return 'clouds';
    default:
      return assertNever(kind);
  }
}
