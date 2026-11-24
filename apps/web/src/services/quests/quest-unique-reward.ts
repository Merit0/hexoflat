import { TOKEN_UNIQUES } from '@hexoflat/engine/content/token-uniques.content';
import { lightNameOfTone, type TLightName } from '@hexoflat/engine/content/token-type-rules';
import type { Reward } from '@hexoflat/engine/quests/quest-definition';
import { attributeRowsOf } from '@hexoflat/engine/tokens/attribute-display';
import { lightTone } from '@hexoflat/engine/tokens/light-tone';
import { resolveUniqueSprite } from '@hexoflat/engine/tokens/sprite-fallback';
import { SPRITE_MANIFEST } from '@hexoflat/engine/tokens/sprite-manifest';
import type { AuthoredAttribute, UniqueTokenContent } from '@hexoflat/engine/tokens/unique-schema';
import { i18n } from '@/i18n';
import { LIGHT_NAME_COLOR, LIGHT_NAME_FRAME_URLS } from '@/render/light';

export interface UniqueRewardRange {
  key: string;
  label: string;
  icon: string;
  range: string;
}

export interface UniqueRewardPreview {
  name: string;
  lightName: TLightName;
  lightColor: string;
  lightUrl: string;
  sprite: string;
  ranges: UniqueRewardRange[];
}

function rangeOf({ attribute, min, max }: AuthoredAttribute): UniqueRewardRange[] {
  const rows = attributeRowsOf({
    attributes: [min, max].map((value) => ({ key: attribute, value })),
    description: [],
  });
  if (rows.length === 0) return [];
  const [low, high] = rows;
  const value = low.value === high.value ? `${low.value}` : `${low.value}–${high.value}`;
  const { t } = i18n.global;
  return [
    { key: attribute, label: t(low.labelKey), icon: low.icon, range: t(low.formatKey, { value }) },
  ];
}

function previewOf(unique: UniqueTokenContent): UniqueRewardPreview {
  const lightName = lightNameOfTone(lightTone('unique', unique.tokenType));
  return {
    name: i18n.global.t(unique.name.nameKey),
    lightName,
    lightColor: LIGHT_NAME_COLOR[lightName],
    lightUrl: LIGHT_NAME_FRAME_URLS[lightName],
    sprite: resolveUniqueSprite(SPRITE_MANIFEST, unique.key).path,
    ranges: unique.authoredAttributes.flatMap(rangeOf),
  };
}

export function uniqueRewardPreview(
  reward: Reward,
  uniqueReward: string | undefined,
): UniqueRewardPreview | null {
  if (reward.kind !== 'item' || !uniqueReward) return null;
  const unique = TOKEN_UNIQUES.find(({ key }) => key === uniqueReward);
  return unique && unique.type === reward.itemKey ? previewOf(unique) : null;
}
