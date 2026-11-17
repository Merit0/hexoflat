import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import { TOKEN_CONTENT, type TokenContent } from '../../content/token-content';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import type { SpriteManifest } from '../sprite-files';
import { BASE_REALMS, MAP_TIERS, wordKeyOf } from '../token-keys';
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
  'content.tokens.prefix.glass': 'Glassy',
  'content.tokens.suffix.lighthouse': 'of the Lighthouse',
  'content.tokens.attr.ward': 'Ward +{value}',
};

export function extendedContent(): TokenContent {
  return {
    types: [
      ...TOKEN_CONTENT.types,
      {
        key: 'hammer',
        slot: 'weapon',
        strike: 3,
        tool: null,
        nounKey: wordKeyOf('noun', 'hammer'),
        realms: [ERarityKind.SPARK],
      },
    ],
    attributes: [
      ...TOKEN_CONTENT.attributes,
      {
        key: 'ward',
        valueByTier: { 1: 3, 2: 4, 3: 5, 4: 6 },
        weight: 50,
        allowedTypes: ['hammer'],
        implemented: true,
      },
    ],
    words: {
      prefixes: [
        ...TOKEN_CONTENT.words.prefixes,
        { key: wordKeyOf('prefix', 'glass'), realms: [ERarityKind.SPARK] },
      ],
      suffixes: [
        ...TOKEN_CONTENT.words.suffixes,
        { key: wordKeyOf('suffix', 'lighthouse'), realms: [ERarityKind.SPARK] },
      ],
    },
    priceRanges: TOKEN_CONTENT.priceRanges,
  };
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
