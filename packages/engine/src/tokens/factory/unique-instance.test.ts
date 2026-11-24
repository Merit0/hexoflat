import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../content/attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from '../../content/equipment-attributes.content';
import { TOKEN_CONTENT } from '../../content/token-content';
import { TOKEN_UNIQUES } from '../../content/token-uniques.content';
import { UNIQUE_ATTRIBUTE_MULTIPLIER } from '../../content/unique-rules.content';
import { ITEM_TYPES } from '../../content/item-types.content';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { MAP_TIERS, type TMapTier } from '../token-keys';
import { currentItemTokenSchema, type ItemToken } from '../token-schema';
import { uniqueAttributeProfiles } from '../unique-attribute-profiles';
import { uniqueTextKeys, type UniqueTokenContent } from '../unique-schema';
import { uniqueContentFailures } from '../../content/validate-tokens';
import { createTokenFactory } from './create-token-factory';

const ITERATIONS = 500;

function fixture(
  key: string,
  type: string,
  authoredAttributes: UniqueTokenContent['authoredAttributes'],
): UniqueTokenContent {
  const text = uniqueTextKeys(key);
  return {
    ...TOKEN_UNIQUES[0],
    key,
    name: { kind: 'authored', nameKey: text.name },
    descriptionKey: text.description,
    type,
    authoredAttributes,
  };
}

const TEMPLATES: readonly UniqueTokenContent[] = [
  ...TOKEN_UNIQUES,
  fixture('test-blade', 'sword', [
    { attribute: 'crit-chance', min: 1, max: 9 },
    { attribute: 'heart', min: 2, max: 8 },
  ]),
  fixture('test-ward', 'shield', [{ attribute: 'will', min: 5, max: 30 }]),
  fixture('test-axe', 'axe', []),
];

const factory = createTokenFactory(TOKEN_CONTENT, SPRITE_MANIFEST, TEMPLATES);
const UNIQUE_PROFILES = uniqueAttributeProfiles(ATTRIBUTE_PROFILES, EQUIPMENT_ATTRIBUTES);

function mint(key: string, n: number, mapTier: TMapTier, seed = 'da4b-instances'): ItemToken {
  const made = factory.createUnique(key, { seed, sourceId: `test:da4b.${key}`, n, mapTier });
  if (!made.ok) throw new Error(`${made.refusal.code}: ${made.refusal.message}`);
  return made.value;
}

describe('DA4b-1: 500 instances of every template over every map level', () => {
  it('the fixture templates pass the unique content check', () => {
    expect(uniqueContentFailures(TEMPLATES)).toEqual([]);
  });

  it.each(TEMPLATES.map((template) => [template.key, template] as const))(
    '%s: schema, bounds, keys and instance ids',
    (key, template) => {
      const authored = new Map(
        template.authoredAttributes.map((entry) => [entry.attribute, entry] as const),
      );
      const group = ITEM_TYPES.find((type) => type.key === template.type)!.group;
      const instanceIds = new Set<string>();
      for (const mapTier of MAP_TIERS) {
        const profile = UNIQUE_PROFILES[`tier-${mapTier}`];
        const counts = new Set<number>();
        for (let n = 0; n < ITERATIONS; n += 1) {
          const token = mint(key, (mapTier - 1) * ITERATIONS + n, mapTier);
          expect(currentItemTokenSchema.safeParse(token).success).toBe(true);
          expect(token).toMatchObject({ tier: 'unique', uniqueKey: key, mapTier });
          instanceIds.add(token.instanceId!);
          const keys = token.attributes.map((attribute) => attribute.key);
          expect(new Set(keys).size).toBe(keys.length);
          expect(keys.slice(keys.length - authored.size)).toEqual([...authored.keys()]);
          counts.add(keys.length - authored.size);
          for (const attribute of token.attributes) {
            const own = authored.get(attribute.key);
            const bounds = own ?? profile.attributes[attribute.key];
            if (!own) expect(profile.attributes[attribute.key].weight[group]).toBeGreaterThan(0);
            expect(attribute.value).toBeGreaterThanOrEqual(bounds.min);
            expect(attribute.value).toBeLessThanOrEqual(bounds.max);
          }
        }
        const { countWeights } = profile;
        expect([...counts].sort()).toEqual([...countWeights.keys()]);
      }
      expect(instanceIds.size).toBe(ITERATIONS * MAP_TIERS.length);
    },
  );

  it('every authored value inside its range can appear', () => {
    const rolled = Array.from({ length: ITERATIONS }, (_, n) => mint('test-blade', n, 1));
    const values = new Set(
      rolled.map((token) => token.attributes.find((entry) => entry.key === 'crit-chance')!.value),
    );
    expect([...values].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('an attribute outside the authored layer reaches values above the base maximum', () => {
    const will = Array.from({ length: ITERATIONS }, (_, n) => mint('test-blade', n, 1))
      .flatMap((token) => token.attributes)
      .filter((attribute) => attribute.key === 'will')
      .map((attribute) => attribute.value);
    expect(Math.max(...will)).toBeGreaterThan(ATTRIBUTE_PROFILES['tier-1'].attributes.will.max);
  });
});

describe('DA4b-2: determinism', () => {
  it.each(TEMPLATES.map((template) => template.key))('%s: same seed, same instance', (key) => {
    for (const mapTier of MAP_TIERS) {
      expect(mint(key, 7, mapTier)).toEqual(mint(key, 7, mapTier));
    }
  });

  it('a different seed gives different attributes and another instance id', () => {
    const sheets = Array.from({ length: 20 }, (_, index) =>
      mint('test-blade', 0, 4, `da4b-seed-${index}`),
    );
    expect(sheets[1].attributes).not.toEqual(sheets[0].attributes);
    expect(new Set(sheets.map((token) => JSON.stringify(token.attributes))).size).toBeGreaterThan(
      10,
    );
    expect(new Set(sheets.map((token) => token.instanceId)).size).toBe(sheets.length);
    expect(new Set(sheets.map((token) => token.id)).size).toBe(1);
  });

  it('the instance id holds no seed', () => {
    const seed = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
    const token = mint('test-blade', 0, 1, seed);
    expect(token.instanceId).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(token)).not.toContain(seed);
  });
});

describe('DA4b-3: generated bounds = base bounds × multiplier', () => {
  it('the multiplier is the placeholder 1.5', () => {
    expect(UNIQUE_ATTRIBUTE_MULTIPLIER).toBe(1.5);
  });

  it.each(MAP_TIERS)('level %i: every attribute, clipped to itemMax and totalCap', (tier) => {
    const base = ATTRIBUTE_PROFILES[`tier-${tier}`];
    const unique = UNIQUE_PROFILES[`tier-${tier}`];
    expect(Object.keys(unique.attributes)).toEqual(Object.keys(base.attributes));
    expect(unique.maxCount).toBe(base.maxCount);
    expect(unique.countWeights).toEqual(base.countWeights);
    for (const [key, entry] of Object.entries(base.attributes)) {
      const definition = EQUIPMENT_ATTRIBUTES.find((attribute) => attribute.key === key)!;
      const limit = Math.min(definition.itemMax ?? Infinity, definition.totalCap ?? Infinity);
      const scaled = (value: number) =>
        definition.aggregate === 'min'
          ? Math.max(1, Math.round(value / 1.5))
          : Math.min(limit, Math.round(value * 1.5));
      expect([key, unique.attributes[key]]).toEqual([
        key,
        { ...entry, min: scaled(entry.min), max: scaled(entry.max) },
      ]);
    }
  });

  it('decided values: half up, clipped to itemMax, a min attribute is divided', () => {
    const range = (tier: TMapTier, key: string) => {
      const { min, max } = UNIQUE_PROFILES[`tier-${tier}`].attributes[key];
      return [min, max];
    };
    expect(MAP_TIERS.map((tier) => range(tier, 'will'))).toEqual([
      [2, 15],
      [2, 30],
      [2, 40],
      [2, 40],
    ]);
    expect(MAP_TIERS.map((tier) => range(tier, 'crit-chance'))).toEqual([
      [3, 3],
      [3, 6],
      [3, 9],
      [3, 10],
    ]);
    expect(range(4, 'crit-dmg')).toEqual([5, 5]);
    expect(range(4, 'trophy')).toEqual([2, 2]);
    expect(MAP_TIERS.map((tier) => range(tier, 'smart-step'))).toEqual([
      [3, 3],
      [3, 3],
      [2, 3],
      [1, 3],
    ]);
  });

  it('keeps the maximum on the step and leaves base profiles alone', () => {
    const profiles = structuredClone(ATTRIBUTE_PROFILES);
    profiles['tier-1'].attributes.will = { weight: { weapon: 1 }, min: 2, max: 8, step: 3 };
    const before = structuredClone(profiles);
    const scaled = uniqueAttributeProfiles(profiles, EQUIPMENT_ATTRIBUTES);
    expect(scaled['tier-1'].attributes.will).toMatchObject({ min: 3, max: 12, step: 3 });
    expect(profiles).toEqual(before);
  });
});
