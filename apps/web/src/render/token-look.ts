import { getPrototype } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import {
  LIGHT_COLOR_BY_TONE,
  lightTone,
  type TLightTone,
} from '@hexoflat/engine/tokens/light-tone';
import { SPRITE_MANIFEST } from '@hexoflat/engine/tokens/sprite-manifest';
import type { SpriteManifest } from '@hexoflat/engine/tokens/sprite-files';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { lightNameOfTone, type TLightName } from '@hexoflat/engine/content/token-type-rules';
import {
  getObjectLightName,
  LIGHT_FRAME_URLS,
  LIGHT_NAME_COLOR,
  lightFrameUrlForKey,
} from './light';

export { LIGHT_FRAMES_DIR } from './light';

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
  return lightTone(token.tier, token.tokenType);
}

export function tokenLightUrl(token: ItemToken): string {
  return LIGHT_FRAME_URLS[LIGHT_COLOR_BY_TONE[tokenLightTone(token)]];
}

export function tokenLightName(token: ItemToken): TLightName {
  return lightNameOfTone(tokenLightTone(token));
}

export function tokenLightColor(token: ItemToken): string {
  return LIGHT_NAME_COLOR[tokenLightName(token)];
}

export function itemLightName(source: LookSource): TLightName | null {
  if (source.token) return tokenLightName(source.token);
  return getObjectLightName(getPrototype(source.key));
}

export function itemLook(source: LookSource): ItemLook {
  if (source.token) {
    return { sprite: tokenSpriteUrl(source.token), light: tokenLightUrl(source.token) };
  }
  return {
    sprite: getPrototype(source.key).spritePath ?? null,
    light: lightFrameUrlForKey(source.key),
  };
}
