import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EQUIP_SLOTS } from '../abstraction/hexobject-abstraction';
import {
  attributeProfilesSchema,
  type AttributeProfiles,
} from '../tokens/equipment/attribute-profile-schema';
import { equipmentAttributeDefinitionSchema } from '../tokens/equipment/equipment-attribute-schema';
import { ADJECTIVE_BANDS, ATTRIBUTE_PROFILE_TIERS } from '../tokens/equipment/equipment-keys';
import { equipmentTypeDefinitionSchema } from '../tokens/equipment/equipment-type-schema';
import { ATTRIBUTE_PROFILES } from './attribute-profiles.content';
import { EQUIPMENT_ATTRIBUTES } from './equipment-attributes.content';
import { EQUIPMENT_TYPES, ITEM_TYPES, PLANNED_ITEM_TYPES } from './item-types.content';
import { TOKEN_ADJECTIVES } from './token-adjectives.content';
import { TOKEN_CONTENT } from './token-content';
import {
  adjectivesFor,
  EQUIPMENT_CONTENT,
  equipmentContentFailures,
  equipmentLocaleKeys,
  MIN_ADJECTIVES_PER_BAND,
} from './validate-equipment';

const LOCALES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/web/src/locales',
);

function localeText(lang: string, key: string): unknown {
  const json: unknown = JSON.parse(
    readFileSync(path.join(LOCALES_DIR, lang, 'content.json'), 'utf-8'),
  );
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], json);
}

const STAT_BY_KEY = {
  heart: 'maxHearts',
  shield: 'blockSides',
  will: 'maxWill',
  fog: 'fogRadius',
  'crit-chance': 'critPoints',
  'crit-dmg': 'critDamage',
  trophy: 'graveLootBonus',
  yield: 'harvestBonus',
  'heal-on-block': 'healOnBlock',
  thorns: 'thorns',
  absorb: 'absorb',
  'hero-crit': 'critPoints',
  'smart-step': 'stepFreeEvery',
  'deft-hands': 'useWillDiscount',
  trade: 'shopBuyDiscountPct',
  wisdom: 'answerWillReward',
  force: 'strikeForce',
  mass: 'pushMass',
  bag: 'carryKg',
} as const;

const BLOCKED_KEYS = [
  'initiative',
  'sweep',
  'feint',
  'knockback',
  'crit-power',
  'damage-plus',
  'damage-mul',
  'defense-plus',
  'counter',
  'steadfast',
  'rest',
];

function withProfiles(change: (profiles: AttributeProfiles) => void) {
  const profiles = structuredClone(ATTRIBUTE_PROFILES);
  change(profiles);
  return equipmentContentFailures({ ...EQUIPMENT_CONTENT, profiles });
}

describe('EA1 equipment content', () => {
  it('passes the equipment content check', () => {
    expect(equipmentContentFailures()).toEqual([]);
  });
});

describe('EA1 EA-16a: attribute registry', () => {
  it('has unique keys: the LG3 keys, the new keys and the blocked stubs', () => {
    const keys = EQUIPMENT_ATTRIBUTES.map((attribute) => attribute.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...Object.keys(STAT_BY_KEY), ...BLOCKED_KEYS].sort());
  });

  it('implements heart, will, fog, trophy, yield, smart-step, deft-hands and wisdom (with legacy focus)', () => {
    expect(
      EQUIPMENT_ATTRIBUTES.filter((attribute) => attribute.implemented).map(
        (attribute) => attribute.key,
      ),
    ).toEqual([
      'heart',
      'shield',
      'will',
      'fog',
      'crit-chance',
      'crit-dmg',
      'trophy',
      'yield',
      'heal-on-block',
      'smart-step',
      'deft-hands',
      'wisdom',
    ]);
  });

  it('maps every open attribute to its hero stat and leaves blocked ones without a stat', () => {
    const stats = Object.fromEntries(
      EQUIPMENT_ATTRIBUTES.map((attribute) => [attribute.key, attribute.stat]),
    );
    expect(stats).toEqual({
      ...STAT_BY_KEY,
      ...Object.fromEntries(BLOCKED_KEYS.map((key) => [key, null])),
    });
  });

  it('refuses an implemented attribute without a hero stat', () => {
    const heart = EQUIPMENT_ATTRIBUTES.find((attribute) => attribute.key === 'heart');
    expect(equipmentAttributeDefinitionSchema.safeParse({ ...heart, stat: null }).success).toBe(
      false,
    );
    expect(
      equipmentAttributeDefinitionSchema.safeParse({ ...heart, stat: null, implemented: false })
        .success,
    ).toBe(true);
  });

  it.each(['en', 'uk'])('every attribute has a %s label and hint', (lang) => {
    for (const key of equipmentLocaleKeys()) {
      const text = localeText(lang, key);
      expect(typeof text === 'string' && text.trim().length > 0, `${lang}: ${key}`).toBe(true);
    }
    expect(equipmentLocaleKeys()).toHaveLength(EQUIPMENT_ATTRIBUTES.length * 2);
  });

  it('is the only attribute registry of the token content (D-EA21)', () => {
    expect(TOKEN_CONTENT.attributes).toBe(EQUIPMENT_ATTRIBUTES);
  });
});

describe('EA1 attribute profiles', () => {
  it.each(ATTRIBUTE_PROFILE_TIERS)('%s parses and its count weights sum to 100', (tier) => {
    expect(attributeProfilesSchema.safeParse(ATTRIBUTE_PROFILES).success).toBe(true);
    const profile = ATTRIBUTE_PROFILES[tier];
    expect(profile.maxCount).toBe(2);
    expect(profile.countWeights.reduce((sum, weight) => sum + weight, 0)).toBe(100);
    for (const [key, entry] of Object.entries(profile.attributes)) {
      expect(entry.min, key).toBeLessThanOrEqual(entry.max);
      expect(entry.step, key).toBeGreaterThan(0);
      expect(
        EQUIPMENT_ATTRIBUTES.some((attribute) => attribute.key === key),
        key,
      ).toBe(true);
    }
  });

  it('holds the count weights of plan §2', () => {
    expect(ATTRIBUTE_PROFILE_TIERS.map((tier) => ATTRIBUTE_PROFILES[tier].countWeights)).toEqual([
      [55, 40, 5],
      [40, 45, 15],
      [25, 50, 25],
      [10, 50, 40],
    ]);
  });

  it('holds the decided heart weights', () => {
    expect(ATTRIBUTE_PROFILES['tier-1'].attributes.heart.weight).toEqual({
      defense: 40,
      clothing: 35,
    });
  });

  it('never lets the base generator roll a Smart Step below 2', () => {
    for (const tier of ATTRIBUTE_PROFILE_TIERS) {
      expect(ATTRIBUTE_PROFILES[tier].attributes['smart-step'].min).toBeGreaterThanOrEqual(2);
    }
  });

  it('lists no blocked attribute in a profile', () => {
    for (const tier of ATTRIBUTE_PROFILE_TIERS) {
      for (const key of BLOCKED_KEYS)
        expect(ATTRIBUTE_PROFILES[tier].attributes[key]).toBeUndefined();
    }
  });

  it.each<[string, (profiles: AttributeProfiles) => void, RegExp]>([
    [
      'an unknown key',
      (profiles) => {
        profiles['tier-1'].attributes.luck = { weight: { weapon: 1 }, min: 1, max: 1, step: 1 };
      },
      /luck is unknown/,
    ],
    [
      'a blocked key',
      (profiles) => {
        profiles['tier-2'].attributes.sweep = { weight: { weapon: 1 }, min: 1, max: 1, step: 1 };
      },
      /sweep is blocked/,
    ],
    [
      'min above max',
      (profiles) => {
        profiles['tier-3'].attributes['crit-chance'].min = 11;
      },
      /min is above max/,
    ],
    [
      'count weights that miss 100',
      (profiles) => {
        profiles['tier-4'].countWeights = [10, 50, 30];
      },
      /sum to 100/,
    ],
    [
      'a weight for a foreign group',
      (profiles) => {
        profiles['tier-1'].attributes['crit-chance'].weight = { weapon: 45, jewelry: 5 };
      },
      /crit-chance has a weight for group jewelry/,
    ],
    [
      'an absorb max above its itemMax',
      (profiles) => {
        profiles['tier-1'].attributes.absorb.max = 2;
      },
      /absorb max 2 is above its itemMax 1/,
    ],
  ])('refuses %s', (_name, change, message) => {
    expect(withProfiles(change).join('\n')).toMatch(message);
  });
});

describe('EA1 item types', () => {
  it('adds helm, armor, gloves, boots, ring and amulet as disabled types', () => {
    expect(PLANNED_ITEM_TYPES.map((type) => [type.key, type.slot, type.enabled])).toEqual([
      ['helm', 'helm', false],
      ['armor', 'armor', false],
      ['gloves', 'gloves', false],
      ['boots', 'boots', false],
      ['ring', 'ring', false],
      ['amulet', 'amulet', false],
    ]);
    for (const type of PLANNED_ITEM_TYPES) {
      expect(EQUIP_SLOTS as readonly string[]).toContain(type.slot);
    }
  });

  it('keeps the disabled types out of the token generator', () => {
    const tokenTypes = TOKEN_CONTENT.types.map((type) => type.key);
    expect(tokenTypes).toEqual(ITEM_TYPES.map((type) => type.key));
    for (const type of PLANNED_ITEM_TYPES) expect(tokenTypes).not.toContain(type.key);
  });

  it('gives every type the base of plan §3–§5b', () => {
    expect(Object.fromEntries(EQUIPMENT_TYPES.map((type) => [type.key, type.base]))).toEqual({
      sword: { damage: 2 },
      shield: { defense: 2, blockSides: 1 },
      axe: { damage: 1 },
      pickaxe: { damage: 1 },
      helm: { hearts: 1 },
      armor: { hearts: 2 },
      gloves: { hearts: 1 },
      boots: { hearts: 1 },
      ring: { will: 1 },
      amulet: { will: 2 },
    });
  });

  it('keeps the base in step with the fields the current rules read', () => {
    for (const type of ITEM_TYPES.filter((candidate) => candidate.group === 'weapon')) {
      expect(type.base.damage, type.key).toBe(type.strike);
    }
    const shield = ITEM_TYPES.find((type) => type.key === 'shield');
    expect(shield?.base.blockSides).toBe(shield?.block?.sides);
  });

  it('refuses a slot outside the group and an any-hand type that is not a tool', () => {
    const [helm] = PLANNED_ITEM_TYPES;
    expect(equipmentTypeDefinitionSchema.safeParse({ ...helm, slot: 'ring' }).success).toBe(false);
    expect(equipmentTypeDefinitionSchema.safeParse({ ...helm, slot: 'any' }).success).toBe(false);
    expect(equipmentTypeDefinitionSchema.safeParse({ ...helm, enabled: true }).success).toBe(false);
  });

  it('refuses an enabled type that the token generator does not know', () => {
    const types = EQUIPMENT_TYPES.map((type) =>
      type.key === 'helm' ? { ...type, enabled: true, strike: 1 } : type,
    );
    expect(equipmentContentFailures({ ...EQUIPMENT_CONTENT, types })).toContain(
      'enabled type helm is not a token type',
    );
  });
});

describe('EA1 EA-6a: adjectives', () => {
  it.each(
    EQUIPMENT_TYPES.filter((type) => type.tool === null).flatMap((type) =>
      ADJECTIVE_BANDS.map((band) => [type.key, band, type] as const),
    ),
  )('%s has at least 3 %s adjectives', (_key, band, type) => {
    expect(adjectivesFor(type, band).length).toBeGreaterThanOrEqual(MIN_ADJECTIVES_PER_BAND);
  });

  it('has four non-empty uk forms and an en word for every adjective', () => {
    for (const adjective of TOKEN_ADJECTIVES) {
      expect(adjective.en.trim(), adjective.key).not.toBe('');
      for (const form of Object.values(adjective.uk))
        expect(form.trim(), adjective.key).not.toBe('');
    }
  });

  it('limits material and group adjectives to the fitting types', () => {
    const keys = (type: string, band: (typeof ADJECTIVE_BANDS)[number]) =>
      adjectivesFor(
        EQUIPMENT_TYPES.find((candidate) => candidate.key === type)!,
        band,
      ).map((adjective) => adjective.key);
    expect(keys('sword', 'fine')).toContain('sharp');
    expect(keys('shield', 'fine')).not.toContain('sharp');
    expect(keys('gloves', 'plain')).toEqual(['iron', 'bronze', 'leather']);
    expect(keys('boots', 'poor')).toContain('rusty');
    expect(keys('amulet', 'poor')).not.toContain('rusty');
  });

  it('refuses a type with fewer than 3 adjectives in a band', () => {
    const adjectives = TOKEN_ADJECTIVES.filter((adjective) => adjective.band !== 'fine');
    expect(equipmentContentFailures({ ...EQUIPMENT_CONTENT, adjectives })).toContain(
      'sword has 0 fine adjectives, needs 3',
    );
  });
});

describe('Wisdom definition', () => {
  it('defines Wisdom as a Will reward capped at five, with its reader enabled', () => {
    expect(EQUIPMENT_ATTRIBUTES.find((attribute) => attribute.key === 'wisdom')).toMatchObject({
      stat: 'answerWillReward',
      aggregate: 'sum',
      itemMax: 5,
      totalCap: 5,
      display: { format: 'plus' },
      implemented: true,
    });
  });
});
