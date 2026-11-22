import { EDimension } from '../../dimensions/dimensions';
import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import { TOKEN_CONTENT, type TokenContent } from '../../content/token-content';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import type { SpriteManifest } from '../sprite-files';
import { BASE_REALMS, MAP_TIERS, wordKeyOf } from '../token-keys';
import {
  attributeHintKey,
  attributeLabelKey,
  type EquipmentAttributeDefinition,
} from '../equipment/equipment-attribute-schema';
import { FIXTURE_ATTRIBUTES, withProfileRow } from '../equipment/generator/generator-test-setup';
import { createTokenFactory } from './create-token-factory';
import type { GenerationContext } from './token-generation';

export function contextFor(
  index: number,
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    seed: String(index),
    sourceId: 'test:factory',
    n: index,
    realm: BASE_REALMS[index % BASE_REALMS.length],
    mapTier: MAP_TIERS[Math.floor(index / BASE_REALMS.length) % MAP_TIERS.length],
    ...overrides,
  };
}

export function mixedContexts(
  count: number,
  typeKeys: readonly (string | undefined)[],
): GenerationContext[] {
  const combos = BASE_REALMS.length * MAP_TIERS.length;
  return Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    return contextFor(index, { type: typeKeys[Math.floor(index / combos) % typeKeys.length] });
  });
}

export const EXTENSION_TEXTS: Readonly<Record<string, string>> = {
  'content.tokens.noun.hammer': 'Hammer',
  'content.tokens.attrLabel.ward': 'Ward',
  'content.tokens.attrHint.ward': 'Wards off a blow.',
};

export const WARD_ATTRIBUTE: EquipmentAttributeDefinition = {
  key: 'ward',
  groups: ['weapon'],
  onlyTypes: ['hammer'],
  stat: 'strikeForce',
  aggregate: 'sum',
  scope: 'item',
  display: {
    labelKey: attributeLabelKey('ward'),
    hintKey: attributeHintKey('ward'),
    icon: 'anvil',
    format: 'plus',
  },
  implemented: true,
};

export function extendedContent(): TokenContent {
  return {
    ...TOKEN_CONTENT,
    baseItems: [
      ...TOKEN_CONTENT.baseItems,
      { key: 'heaven-hammer', dimension: EDimension.HEAVEN, type: 'hammer' },
    ],
    types: [
      ...TOKEN_CONTENT.types,
      {
        key: 'hammer',
        slot: 'weapon',
        strike: 3,
        tool: null,
        nounKey: wordKeyOf('noun', 'hammer'),
        realms: [ERarityKind.SPARK],
        group: 'weapon',
        gender: 'm',
        materials: ['iron'],
        enabled: true,
        base: { damage: 3 },
      },
    ],
    attributes: [...TOKEN_CONTENT.attributes, WARD_ATTRIBUTE],
    profiles: withProfileRow(TOKEN_CONTENT.profiles, 'ward', {
      weight: { weapon: 50 },
      min: 3,
      max: 6,
      step: 1,
    }),
  };
}

export function implementedContent(): TokenContent {
  return { ...TOKEN_CONTENT, attributes: FIXTURE_ATTRIBUTES };
}

export function extendedManifest(): SpriteManifest {
  return {
    ...SPRITE_MANIFEST,
    entries: [
      ...SPRITE_MANIFEST.entries,
      {
        key: 'spark-hammer-01',
        origin: 'base',
        realm: ERarityKind.SPARK,
        type: 'hammer',
        path: '/hex-assets/items/base/spark-hammer/spark-hammer-01.png',
      },
    ],
  };
}

export const defaultFactory = createTokenFactory();
