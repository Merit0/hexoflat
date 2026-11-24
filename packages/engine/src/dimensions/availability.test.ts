import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { BATTLE_ITEMS, battleItemDefSchema } from '../battle/battle-catalogue';
import { BASE_ITEMS } from '../content/base-items.content';
import { CONTENT } from '../content/content-map';
import { ContentDefinitionSchema } from '../content/content-schema';
import { TOKEN_UNIQUES } from '../content/token-uniques.content';
import { validateContent } from '../content/validate-content';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { baseItemDefinitionSchema } from '../tokens/base-item';
import { uniqueTokenDefinitionSchema } from '../tokens/unique-schema';
import { sharedWithSchema } from './availability';
import { dimensionAllowsTier, EDimension } from './dimensions';

const REFUSAL = 'NO_BASE_TIER: cannot share with nowhere';
const ALL = Object.values(EDimension);
const WITH_BASE = ALL.filter((dimension) => dimensionAllowsTier(dimension, 'base'));

const SCHEMAS: [string, z.ZodType, object][] = [
  ['hexobject', ContentDefinitionSchema, CONTENT[HEXOBJECT_KEYS.COINS]],
  ['base item', baseItemDefinitionSchema, BASE_ITEMS[0]],
  ['unique', uniqueTokenDefinitionSchema, TOKEN_UNIQUES[0]],
  ['battle item', battleItemDefSchema, Object.values(BATTLE_ITEMS)[0]],
];

describe('DA8b: sharedWith lists only dimensions with a base tier', () => {
  it.each(ALL)('checks %s against the Dimension record', (dimension) => {
    const result = sharedWithSchema.safeParse([dimension]);
    expect(result.success).toBe(dimensionAllowsTier(dimension, 'base'));
  });

  it('accepts all dimensions with a base tier together, and the word all', () => {
    expect(WITH_BASE).toHaveLength(ALL.length - 1);
    expect(sharedWithSchema.safeParse(WITH_BASE).success).toBe(true);
    expect(sharedWithSchema.safeParse('all').success).toBe(true);
  });

  it.each(SCHEMAS)('the %s schema refuses nowhere by name', (_name, schema, valid) => {
    expect(schema.safeParse({ ...valid, sharedWith: WITH_BASE }).success).toBe(true);
    const refused = schema.safeParse({ ...valid, sharedWith: [EDimension.NOWHERE] });
    expect(refused.success).toBe(false);
    expect(JSON.stringify(refused.error!.issues)).toContain(REFUSAL);
  });
});

describe('DA8b: validateContent', () => {
  afterEach(() => {
    vi.doUnmock('../content/content-map');
    vi.resetModules();
  });

  it('fails while an object is shared with nowhere', async () => {
    expect(() => validateContent()).not.toThrow();
    const coins = { ...CONTENT[HEXOBJECT_KEYS.COINS], sharedWith: [EDimension.NOWHERE] };
    vi.resetModules();
    vi.doMock('../content/content-map', async (load) => {
      const actual = await load<{ CONTENT: typeof CONTENT }>();
      return { ...actual, CONTENT: { ...actual.CONTENT, [HEXOBJECT_KEYS.COINS]: coins } };
    });
    const broken = await import('../content/validate-content');
    expect(() => broken.validateContent()).toThrow(REFUSAL);
  });
});
