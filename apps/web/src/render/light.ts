import { getPrototype } from '@hexoflat/engine';
import {
  EHexobjectGroup,
  type IItemTokenType,
} from '@hexoflat/engine/abstraction/hexobject-abstraction';
import {
  DEFAULT_ITEM_TOKEN_TYPE,
  LIGHTS_BY_NAME,
  LIGHT_NAMES,
  itemTokenTypeOf,
  type TokenTypeCarrier,
  lightNameOf,
  type TLightName,
} from '@hexoflat/engine/content/token-type-rules';
import type { TLightColor } from '@hexoflat/engine/tokens/light-tone';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';

export const LIGHT_FRAMES_DIR = '/hex-assets/hex-frames/';

export const LIGHT_FRAME_URLS: Record<TLightColor, string> = {
  blue: `${LIGHT_FRAMES_DIR}blue-light.png`,
  violet: `${LIGHT_FRAMES_DIR}violet-light.png`,
  gray: `${LIGHT_FRAMES_DIR}gray-light.png`,
  green: `${LIGHT_FRAMES_DIR}green-light.png`,
  yellow: `${LIGHT_FRAMES_DIR}yellow-light.png`,
  orange: `${LIGHT_FRAMES_DIR}orange-light.png`,
  red: `${LIGHT_FRAMES_DIR}red-light.png`,
};

function byLightName<T>(value: (tone: TLightName) => T): Record<TLightName, T> {
  return Object.fromEntries(LIGHT_NAMES.map((tone) => [tone, value(tone)])) as Record<
    TLightName,
    T
  >;
}

export const LIGHT_NAME_FRAME_URLS: Record<TLightName, string> = byLightName(
  (tone) => LIGHT_FRAME_URLS[LIGHTS_BY_NAME[tone].id],
);

export const LIGHT_NAME_COLOR: Record<TLightName, string> = byLightName(
  (tone) => LIGHTS_BY_NAME[tone].color,
);

interface ITokenTypeSource {
  token?: TokenTypeCarrier;
  groupType: EHexobjectGroup;
  tool?: { tokenType?: IItemTokenType };
  equipment?: { tokenType?: IItemTokenType };
  loot?: { tokenType?: IItemTokenType };
}

export function getObjectTokenType(obj: ITokenTypeSource): IItemTokenType | null {
  if (obj.token) return itemTokenTypeOf(obj.token);
  if (obj.groupType === EHexobjectGroup.TOOL) return obj.tool?.tokenType ?? DEFAULT_ITEM_TOKEN_TYPE;
  if (obj.groupType === EHexobjectGroup.EQUIPMENT) {
    return obj.equipment?.tokenType ?? DEFAULT_ITEM_TOKEN_TYPE;
  }
  if (obj.groupType === EHexobjectGroup.LOOT) return obj.loot?.tokenType ?? null;

  return null;
}

export function getObjectLightName(obj: ITokenTypeSource): TLightName | null {
  const tokenType = getObjectTokenType(obj);

  return tokenType ? lightNameOf(tokenType) : null;
}

export function lightFrameUrlForKey(key: THexobjectKey): string | null {
  const tone = getObjectLightName(getPrototype(key));
  return tone ? LIGHT_NAME_FRAME_URLS[tone] : null;
}
