import { getPrototype } from '@hexoflat/engine';
import {
  EHexobjectGroup,
  type IItemRarity,
} from '@hexoflat/engine/abstraction/hexobject-abstraction';
import {
  DEFAULT_RARITY,
  RARITY_TONE_LIGHTS,
  RARITY_TONES,
  tokenRarity,
  type RarityCarrier,
  rarityTone,
  type TRarityTone,
} from '@hexoflat/engine/content/rarity-rules';
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

function byRarityTone<T>(value: (tone: TRarityTone) => T): Record<TRarityTone, T> {
  return Object.fromEntries(RARITY_TONES.map((tone) => [tone, value(tone)])) as Record<
    TRarityTone,
    T
  >;
}

export const RARITY_FRAME_URLS: Record<TRarityTone, string> = byRarityTone(
  (tone) => LIGHT_FRAME_URLS[RARITY_TONE_LIGHTS[tone].id],
);

export const RARITY_COLOR: Record<TRarityTone, string> = byRarityTone(
  (tone) => RARITY_TONE_LIGHTS[tone].color,
);

interface IRaritySource {
  token?: RarityCarrier;
  groupType: EHexobjectGroup;
  tool?: { rarity?: IItemRarity };
  equipment?: { rarity?: IItemRarity };
  loot?: { rarity?: IItemRarity };
}

export function getObjectRarity(obj: IRaritySource): IItemRarity | null {
  if (obj.token) return tokenRarity(obj.token);
  if (obj.groupType === EHexobjectGroup.TOOL) return obj.tool?.rarity ?? DEFAULT_RARITY;
  if (obj.groupType === EHexobjectGroup.EQUIPMENT) {
    return obj.equipment?.rarity ?? DEFAULT_RARITY;
  }
  if (obj.groupType === EHexobjectGroup.LOOT) return obj.loot?.rarity ?? null;

  return null;
}

export function getObjectRarityTone(obj: IRaritySource): TRarityTone | null {
  const rarity = getObjectRarity(obj);

  return rarity ? rarityTone(rarity) : null;
}

export function rarityFrameUrlForKey(key: THexobjectKey): string | null {
  const tone = getObjectRarityTone(getPrototype(key));
  return tone ? RARITY_FRAME_URLS[tone] : null;
}
