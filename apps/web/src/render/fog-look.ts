export type FogLook = 'clouds' | 'mist';

const CLOUD_SPRITE_URL = '/hex-assets/hex-effects/cloud-hex.png';
const MIST_SPRITE_URL = '/hex-assets/hex-effects/fog-hex.png';

export type HiddenTileLook = { kind: 'texture'; url: string };

export function hiddenTileLook(look: FogLook): HiddenTileLook {
  return { kind: 'texture', url: look === 'clouds' ? CLOUD_SPRITE_URL : MIST_SPRITE_URL };
}

export function fogLookForBoardKind(kind: 'STATIC' | 'DUNGEON' | undefined): FogLook {
  return kind === 'DUNGEON' ? 'mist' : 'clouds';
}
