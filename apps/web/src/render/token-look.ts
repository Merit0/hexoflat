import { getPrototype } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { lightFrameFile, lightTone, type TLightTone } from '@hexoflat/engine/tokens/light-tone';
import { SPRITE_MANIFEST } from '@hexoflat/engine/tokens/sprite-manifest';
import type { SpriteManifest } from '@hexoflat/engine/tokens/sprite-files';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import type { TRarityTone } from '@hexoflat/engine/content/rarity-rules';
import { getObjectRarityTone, RARITY_COLOR, rarityFrameUrlForKey } from './rarity';

export const LIGHT_FRAMES_DIR = '/hex-assets/hex-frames/';

const RARITY_TONE_BY_LIGHT: Record<TLightTone, TRarityTone> = {
  'gloom-base': 'gloom',
  'gloom-unique': 'gloom-boss',
  'idol-base': 'idol',
  'idol-unique': 'idol-boss',
  'spark-base': 'spark',
  'spark-unique': 'spark-boss',
  'alien-unique': 'alien',
};

export interface ItemLook {
  sprite: string | null;
  light: string | null;
}

interface LookSource {
  key: THexobjectKey;
  token?: ItemToken | null;
}

export function tokenSpriteUrl(
  token: ItemToken,
  manifest: SpriteManifest = SPRITE_MANIFEST,
): string {
  const entry = manifest.entries.find((candidate) => candidate.key === token.sprite);
  return entry?.path ?? manifest.placeholder;
}

export function tokenLightTone(token: ItemToken): TLightTone {
  return lightTone(token.origin, token.rarity);
}

export function tokenLightUrl(token: ItemToken): string {
  return `${LIGHT_FRAMES_DIR}${lightFrameFile(tokenLightTone(token))}`;
}

export function tokenRarityTone(token: ItemToken): TRarityTone {
  return RARITY_TONE_BY_LIGHT[tokenLightTone(token)];
}

export function tokenLightColor(token: ItemToken): string {
  return RARITY_COLOR[tokenRarityTone(token)];
}

export function itemRarityTone(source: LookSource): TRarityTone | null {
  if (source.token) return tokenRarityTone(source.token);
  return getObjectRarityTone(getPrototype(source.key));
}

export function itemLook(source: LookSource): ItemLook {
  if (source.token) {
    return { sprite: tokenSpriteUrl(source.token), light: tokenLightUrl(source.token) };
  }
  return {
    sprite: getPrototype(source.key).spritePath ?? null,
    light: rarityFrameUrlForKey(source.key),
  };
}
