import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import {
  descriptionLineSchema,
  emptyTokenExtensions,
  itemTokenEntrySchema,
  itemTokenSchema,
  tokenExtensionsSchema,
  tokenNameSchema,
} from './token-schema';
import { sampleToken } from './token-test-setup';

interface SchemaCase {
  name: string;
  schema: z.ZodType;
  valid: unknown;
  invalid: [string, unknown][];
}

const CASES: SchemaCase[] = [
  {
    name: 'ItemToken',
    schema: itemTokenSchema,
    valid: sampleToken(),
    invalid: [
      ['an unknown field', { ...sampleToken(), durability: 30 }],
      ['a base god-executor token', sampleToken({ rarity: ERarityKind.GOD_EXECUTOR })],
      ['a unique token without uniqueKey', sampleToken({ origin: 'unique' })],
    ],
  },
  {
    name: 'TokenName',
    schema: tokenNameSchema,
    valid: { kind: 'authored', nameKey: 'content.uniques.ember-crown.name' },
    invalid: [
      ['an unknown kind', { kind: 'random', nameKey: 'content.tokens.noun.sword' }],
      [
        'a suffix key in the prefix place',
        {
          kind: 'generated',
          prefix: 'content.tokens.suffix.warden',
          noun: 'sword',
          suffix: 'content.tokens.suffix.warden',
        },
      ],
      [
        'an extra field on an authored name',
        { kind: 'authored', nameKey: 'content.x.name', prefix: 'content.tokens.prefix.ash' },
      ],
    ],
  },
  {
    name: 'DescriptionLine',
    schema: descriptionLineSchema,
    valid: { key: 'content.tokens.noun.sword', params: { strike: 2, realm: 'idol' } },
    invalid: [
      ['a key outside content', { key: 'tokens.noun.sword', params: {} }],
      ['a boolean param', { key: 'content.tokens.noun.sword', params: { strike: true } }],
      ['no params', { key: 'content.tokens.noun.sword' }],
    ],
  },
  {
    name: 'TokenExtensions',
    schema: tokenExtensionsSchema,
    valid: emptyTokenExtensions(),
    invalid: [
      ['a removed durability field', { aspects: [], heroGrade: null, durability: 10 }],
      ['hero grade 0', { aspects: [], heroGrade: 0 }],
      ['a malformed aspect key', { aspects: ['Burning Edge'], heroGrade: null }],
    ],
  },
  {
    name: 'ItemTokenEntry',
    schema: itemTokenEntrySchema,
    valid: { kind: 'token', token: sampleToken() },
    invalid: [
      ['a stack of an unknown key', { kind: 'stack', itemKey: 'dragon-egg', amount: 1 }],
      ['an empty stack', { kind: 'stack', itemKey: 'coins', amount: 0 }],
      ['an extra field on the token branch', { kind: 'token', token: sampleToken(), amount: 1 }],
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

describe('tool names', () => {
  it('accepts a tool token named only by its type', () => {
    const axe = sampleToken({ type: 'axe', name: { kind: 'noun', noun: 'axe' } });
    expect(itemTokenSchema.safeParse(axe).success).toBe(true);
  });

  it('rejects a noun name of another type', () => {
    const axe = sampleToken({ type: 'axe', name: { kind: 'noun', noun: 'pickaxe' } });
    expect(itemTokenSchema.safeParse(axe).success).toBe(false);
  });
});

describe('ItemTokenEntry stack branch', () => {
  it('keeps the current stack shape', () => {
    expect(itemTokenEntrySchema.parse({ kind: 'stack', itemKey: 'coins', amount: 30 })).toEqual({
      kind: 'stack',
      itemKey: 'coins',
      amount: 30,
    });
  });
});
