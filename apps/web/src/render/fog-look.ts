export type FogLook = 'clouds' | 'dark';

const CLOUD_SPRITE_URL = '/hex-assets/hex-effects/cloud-hex.png';
const DARK_FOG_SPRITE_URL: string | null = null;
const DARK_FOG_COLOR = 0x0f1218;

export type HiddenTileLook = { kind: 'texture'; url: string } | { kind: 'fill'; color: number };

export function hiddenTileLook(look: FogLook): HiddenTileLook {
  if (look === 'clouds') return { kind: 'texture', url: CLOUD_SPRITE_URL };
  return DARK_FOG_SPRITE_URL
    ? { kind: 'texture', url: DARK_FOG_SPRITE_URL }
    : { kind: 'fill', color: DARK_FOG_COLOR };
}

export function fogLookForPolicy(policy: string | undefined): FogLook {
  return policy === 'BY_REGION' ? 'dark' : 'clouds';
}
