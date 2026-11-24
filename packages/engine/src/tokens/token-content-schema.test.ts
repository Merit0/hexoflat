import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { EHexActionType } from '../enums/hex-action-type';
import {
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
  tokenTypes: [ETokenType.IDOL],
};
const RANGES = { gloom: [60, 800], idol: [40, 600], spark: [100, 1200] };
const WORDS = {
  prefixes: [{ key: 'content.tokens.prefix.ash' }],
  suffixes: [{ key: 'content.tokens.suffix.warden', tokenTypes: [ETokenType.GLOOM] }],
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
    name: 'TokenPriceRanges',
    schema: tokenPriceRangesSchema,
    valid: RANGES,
    invalid: [
      ['a alien range', { ...RANGES, alien: [500, 3000] }],
      ['min above max', { ...RANGES, idol: [600, 40] }],
      ['a missing tokenType', { gloom: [60, 800], idol: [40, 600] }],
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
        'a alien tokenType tag',
        { ...WORDS, prefixes: [{ key: 'content.tokens.prefix.ash', tokenTypes: ['alien'] }] },
      ],
      [
        'an empty tokenType list',
        { ...WORDS, prefixes: [{ key: 'content.tokens.prefix.ash', tokenTypes: [] }] },
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
