import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { EHexActionType } from '../enums/hex-action-type';
import {
  attributeDefinitionSchema,
  itemTypeDefinitionSchema,
  tokenPriceRangesSchema,
  wordPoolDataSchema,
} from './token-content-schema';

interface SchemaCase {
  name: string;
  schema: z.ZodType;
  valid: unknown;
  invalid: [string, unknown][];
}

const AXE = {
  key: 'axe',
  slot: 'any',
  strike: 1,
  tool: { action: EHexActionType.CUT, durabilityCostPct: 0.1 },
  nounKey: 'content.tokens.noun.axe',
  realms: [ERarityKind.IDOL],
};
const HEART = {
  key: 'heart',
  valueByTier: { 1: 1, 2: 1, 3: 2, 4: 2 },
  weight: 1,
  implemented: true,
};
const RANGES = { gloom: [60, 800], idol: [40, 600], spark: [100, 1200] };
const WORDS = {
  prefixes: [{ key: 'content.tokens.prefix.ash' }],
  suffixes: [{ key: 'content.tokens.suffix.warden', realms: [ERarityKind.GLOOM] }],
};

const CASES: SchemaCase[] = [
  {
    name: 'ItemTypeDefinition',
    schema: itemTypeDefinitionSchema,
    valid: AXE,
    invalid: [
      ['a hand slot', { ...AXE, slot: 'hand' }],
      ['a fractional strike', { ...AXE, strike: 0.5 }],
      [
        'a tool action that is not CUT or MINE',
        { ...AXE, tool: { action: EHexActionType.USE, durabilityCostPct: 0.1 } },
      ],
      ['a tool without wear', { ...AXE, tool: { action: EHexActionType.CUT } }],
      ['a wear above 1', { ...AXE, tool: { action: EHexActionType.CUT, durabilityCostPct: 2 } }],
    ],
  },
  {
    name: 'AttributeDefinition',
    schema: attributeDefinitionSchema,
    valid: HEART,
    invalid: [
      ['no tier 4', { ...HEART, valueByTier: { 1: 1, 2: 1, 3: 2 } }],
      ['a half value', { ...HEART, valueByTier: { 1: 0.5, 2: 1, 3: 2, 4: 2 } }],
      ['zero weight', { ...HEART, weight: 0 }],
    ],
  },
  {
    name: 'TokenPriceRanges',
    schema: tokenPriceRangesSchema,
    valid: RANGES,
    invalid: [
      ['a god-executor range', { ...RANGES, 'god-executor': [500, 3000] }],
      ['min above max', { ...RANGES, idol: [600, 40] }],
      ['a missing realm', { gloom: [60, 800], idol: [40, 600] }],
    ],
  },
  {
    name: 'WordPoolData',
    schema: wordPoolDataSchema,
    valid: WORDS,
    invalid: [
      [
        'a suffix key among prefixes',
        { ...WORDS, prefixes: [{ key: 'content.tokens.suffix.warden' }] },
      ],
      [
        'a god-executor realm tag',
        { ...WORDS, prefixes: [{ key: 'content.tokens.prefix.ash', realms: ['god-executor'] }] },
      ],
      [
        'an empty realm list',
        { ...WORDS, prefixes: [{ key: 'content.tokens.prefix.ash', realms: [] }] },
      ],
    ],
  },
];

describe.each(CASES)('$name schema', ({ schema, valid, invalid }) => {
  it('accepts a valid sample', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(invalid)('rejects %s', (_label, sample) => {
    expect(schema.safeParse(sample).success).toBe(false);
  });
});
