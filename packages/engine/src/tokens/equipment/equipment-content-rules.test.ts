import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../content/attribute-profiles.content';
import { TOKEN_CONTENT, type TokenContent } from '../../content/token-content';
import { EQUIPMENT_CONTENT, equipmentContentFailures } from '../../content/validate-equipment';
import { TOKEN_UNIQUES } from '../../content/token-uniques.content';
import { tokenContentFailures, uniqueContentFailures } from '../../content/validate-tokens';
import { attributeRowsOf } from '../attribute-display';
import { createTokenFactory } from '../factory/create-token-factory';
import { contextFor, defaultFactory } from '../factory/factory-test-setup';
import { MAP_TIERS, mapTierSchema } from '../token-keys';
import { itemTokenSchema } from '../token-schema';
import {
  equipmentAttributeDefinitionSchema,
  type EquipmentAttributeDefinition,
} from './equipment-attribute-schema';
import { attributeProfilesSchema } from './attribute-profile-schema';
import { ATTRIBUTE_PROFILE_TIERS } from './equipment-keys';
import { resolveHeroStats } from './hero-stats';
import { resolveItemStats } from './item-stats';
import { sampleToken } from '../token-test-setup';

function withAttribute(
  key: string,
  change: Partial<EquipmentAttributeDefinition>,
): EquipmentAttributeDefinition[] {
  return EQUIPMENT_CONTENT.attributes.map((attribute) =>
    attribute.key === key ? { ...attribute, ...change } : attribute,
  );
}

function failuresWith(attributes: EquipmentAttributeDefinition[]): string[] {
  return equipmentContentFailures({ ...EQUIPMENT_CONTENT, attributes });
}

function withBaseAllowlist(key: string, attributes: string[]): TokenContent {
  return {
    ...TOKEN_CONTENT,
    baseItems: TOKEN_CONTENT.baseItems.map((item) =>
      item.key === key ? { ...item, attributes } : item,
    ),
  };
}

describe('AG1 real content', () => {
  it('passes every content rule', () => {
    expect(equipmentContentFailures()).toEqual([]);
    expect(tokenContentFailures()).toEqual([]);
  });
});

describe('AG1 F3: one aggregate per stat', () => {
  it('refuses two attributes of one stat with different aggregates', () => {
    const attributes = withAttribute('hero-crit', {
      stat: 'critPoints',
      aggregate: 'max',
      scope: 'item',
      implemented: true,
    });
    expect(failuresWith(attributes)).toContain(
      'stat critPoints mixes aggregates: crit-chance sum, hero-crit max',
    );
    expect(() => resolveItemStats(null, attributes)).toThrow(/same aggregate/);
  });
});

describe('AG4-5: one scope per stat', () => {
  it('keeps the weapon and the hero crit on separate stats', () => {
    const scopes = (stat: string) =>
      EQUIPMENT_CONTENT.attributes
        .filter((attribute) => attribute.stat === stat)
        .map((attribute) => `${attribute.key} ${attribute.scope}`);
    expect(scopes('critPoints')).toEqual(['crit-chance item']);
    expect(scopes('heroCritPoints')).toEqual(['hero-crit hero']);
  });

  it.each([false, true])(
    'refuses a stat used by item and hero scope (implemented: %s)',
    (implemented) => {
      const attributes = withAttribute('hero-crit', { stat: 'critPoints', implemented });
      expect(failuresWith(attributes)).toContain(
        'stat critPoints mixes scopes: crit-chance item, hero-crit hero',
      );
    },
  );
});

describe('AG1 F6: silent no-ops', () => {
  it('refuses an implemented attribute that no tier profile rolls', () => {
    expect(failuresWith(withAttribute('force', { implemented: true }))).toContain(
      'attribute force is implemented but no tier profile rolls it',
    );
  });

  it('does not ask a deprecated attribute for a profile', () => {
    const attributes = withAttribute('force', { implemented: true, deprecated: true });
    expect(failuresWith(attributes).join('\n')).not.toMatch(/force is implemented/);
  });

  it('refuses a profile weight for a group whose types cannot carry the attribute', () => {
    const attributes = withAttribute('deft-hands', { groups: ['clothing', 'defense'] });
    const profiles = structuredClone(ATTRIBUTE_PROFILES);
    profiles['tier-2'].attributes['deft-hands'].weight = { clothing: 30, defense: 10 };
    expect(equipmentContentFailures({ ...EQUIPMENT_CONTENT, attributes, profiles })).toContain(
      'tier-2: attribute deft-hands has a weight for group defense, but no type there can carry it',
    );
  });
});

describe('AG1 F10: name and price bands', () => {
  it('refuses more attributes per item than there are bands to tell them apart', () => {
    const profiles = structuredClone(ATTRIBUTE_PROFILES);
    profiles['tier-4'].maxCount = 3;
    profiles['tier-4'].countWeights = [10, 40, 30, 20];
    expect(equipmentContentFailures({ ...EQUIPMENT_CONTENT, profiles })).toContain(
      'tier-4: maxCount 3 needs 4 name and price bands, there are 3',
    );
  });
});

describe('AG1 F4: base item allowlists', () => {
  it('refuses an allowlist key that the base item type cannot carry', () => {
    const content = withBaseAllowlist('earth-sword', ['fog']);
    expect(tokenContentFailures(content)).toEqual([
      'base item earth-sword allows fog, which type sword cannot carry',
      'base item earth-sword allows no attribute that a tier rolls on sword',
    ]);
    expect(() => createTokenFactory(content)).toThrow(/earth-sword allows fog/);
  });

  it('refuses an allowlist key that is not implemented', () => {
    expect(tokenContentFailures(withBaseAllowlist('earth-shield', ['thorns', 'heart']))).toEqual([
      'base item earth-shield allows thorns, which is not implemented',
    ]);
  });

  it('accepts an allowlist that rolls on its type', () => {
    expect(tokenContentFailures(withBaseAllowlist('earth-sword', ['crit-chance']))).toEqual([]);
    expect(() =>
      createTokenFactory(withBaseAllowlist('earth-sword', ['crit-chance'])),
    ).not.toThrow();
  });
});

describe('AG1 F12: one profile rule for content and factory', () => {
  it('refuses a blocked attribute in the factory profiles too', () => {
    const profiles = structuredClone(ATTRIBUTE_PROFILES);
    profiles['tier-1'].attributes.sweep = { weight: { weapon: 1 }, min: 1, max: 1, step: 1 };
    expect(() => createTokenFactory({ ...TOKEN_CONTENT, profiles })).toThrow(
      'tier-1: attribute sweep is blocked',
    );
  });
});

describe('AG3 F1: combat attributes stay off tools', () => {
  it('marks crit-chance, crit-dmg and trophy as not for tools', () => {
    const excluded = EQUIPMENT_CONTENT.attributes
      .filter((attribute) => attribute.excludes?.tool)
      .map((attribute) => attribute.key);
    expect(excluded).toEqual(['crit-chance', 'crit-dmg', 'trophy']);
  });

  it('refuses an attribute that both requires and excludes a tool', () => {
    expect(failuresWith(withAttribute('yield', { excludes: { tool: true } })).join('\n')).toMatch(
      /cannot both require and exclude a tool/,
    );
  });

  it('refuses a tool exclusion when its groups hold only tools', () => {
    const types = EQUIPMENT_CONTENT.types.filter((type) => type.key !== 'sword');
    expect(equipmentContentFailures({ ...EQUIPMENT_CONTENT, types })).toContain(
      'attribute crit-chance excludes tools, but no other type is in its groups',
    );
  });

  it('keeps an owned axe with crit-chance readable and shown', () => {
    const made = defaultFactory.createBase(contextFor(1, { type: 'axe', mapTier: 2 }), {
      attributes: [],
    });
    if (!made.ok) throw new Error(made.refusal.message);
    const owned = itemTokenSchema.parse({
      ...made.value,
      attributes: [{ key: 'crit-chance', value: 4 }],
    });
    expect(attributeRowsOf(owned).map((row) => row.icon)).toEqual(['bolt']);
    expect(
      defaultFactory.createBase(contextFor(1, { type: 'axe', mapTier: 2 }), {
        attributes: [{ key: 'crit-chance', value: 4 }],
      }).ok,
    ).toBe(false);
  });
});

describe('AG4 F2: attribute requirements', () => {
  it('lets crit-dmg roll only after crit-chance', () => {
    expect(EQUIPMENT_CONTENT.attributes.find(({ key }) => key === 'crit-dmg')?.requires).toEqual({
      attributes: ['crit-chance'],
    });
  });

  it('refuses a self requirement and an empty requires in the schema', () => {
    expect(
      failuresWith(withAttribute('crit-dmg', { requires: { attributes: ['crit-dmg'] } })).join(
        '\n',
      ),
    ).toMatch(/cannot require itself/);
    expect(failuresWith(withAttribute('crit-dmg', { requires: {} })).join('\n')).toMatch(
      /requires needs a tool or attributes/,
    );
  });

  it('refuses an unknown requirement and a requirement cycle', () => {
    expect(
      failuresWith(withAttribute('crit-dmg', { requires: { attributes: ['luck'] } })),
    ).toContain('attribute crit-dmg requires unknown luck');
    const cycle = withAttribute('crit-chance', { requires: { attributes: ['crit-dmg'] } });
    expect(failuresWith(cycle)).toContain(
      'attribute crit-chance has a requirement cycle: crit-chance -> crit-dmg -> crit-chance',
    );
  });

  it('refuses a requirement that cannot roll where the dependent rolls', () => {
    const attributes = withAttribute('crit-dmg', { requires: { attributes: ['heart'] } });
    expect(failuresWith(attributes)).toContain(
      'tier-2: attribute crit-dmg rolls on sword only after heart, which cannot roll there',
    );
  });

  it('refuses a requirement chain longer than maxCount', () => {
    const profiles = structuredClone(ATTRIBUTE_PROFILES);
    profiles['tier-3'].maxCount = 1;
    profiles['tier-3'].countWeights = [50, 50];
    expect(equipmentContentFailures({ ...EQUIPMENT_CONTENT, profiles })).toContain(
      'tier-3: attribute crit-dmg needs 2 attributes, maxCount is 1',
    );
  });

  it('refuses a base allowlist that holds a dependent without its requirement', () => {
    expect(tokenContentFailures(withBaseAllowlist('earth-sword', ['crit-dmg', 'will']))).toEqual([
      'base item earth-sword allows crit-dmg without crit-chance',
    ]);
    expect(
      tokenContentFailures(withBaseAllowlist('earth-sword', ['crit-chance', 'crit-dmg'])),
    ).toEqual([]);
  });

  it('refuses a unique whose attribute misses its requirement', () => {
    const unique = TOKEN_UNIQUES[0];
    const uniques = [{ ...unique, type: 'sword', attributes: [{ key: 'crit-dmg', value: 3 }] }];
    expect(uniqueContentFailures(uniques)).toContain(
      `unique ${unique.key}: Attribute crit-dmg needs crit-chance on the same item`,
    );
    expect(() => createTokenFactory(TOKEN_CONTENT, undefined, uniques)).toThrow(
      /needs crit-chance on the same item/,
    );
  });

  it('refuses a factory override that misses the requirement', () => {
    const context = contextFor(1, { type: 'sword', mapTier: 3 });
    const alone = defaultFactory.createBase(context, {
      attributes: [{ key: 'crit-dmg', value: 3 }],
    });
    expect(alone).toMatchObject({ ok: false, refusal: { code: 'INVALID_TOKEN' } });
    expect(
      defaultFactory.createBase(context, {
        attributes: [
          { key: 'crit-chance', value: 2 },
          { key: 'crit-dmg', value: 3 },
        ],
      }).ok,
    ).toBe(true);
  });
});

describe('AG5 F5: itemMax and totalCap', () => {
  const byKey = (key: string) => EQUIPMENT_CONTENT.attributes.find((entry) => entry.key === key)!;
  const shieldUnique = (value: number) => [
    { ...TOKEN_UNIQUES[0], type: 'shield', attributes: [{ key: 'shield', value }] },
  ];

  it('refuses a cap on a min aggregate and an itemMax above totalCap', () => {
    const step = byKey('smart-step');
    expect(equipmentAttributeDefinitionSchema.safeParse({ ...step, itemMax: 3 }).success).toBe(
      false,
    );
    expect(equipmentAttributeDefinitionSchema.safeParse({ ...step, totalCap: 3 }).success).toBe(
      false,
    );
    const crit = byKey('crit-chance');
    expect(
      equipmentAttributeDefinitionSchema.safeParse({ ...crit, itemMax: 11, totalCap: 10 }).success,
    ).toBe(false);
  });

  it('refuses an implemented attribute without itemMax', () => {
    expect(failuresWith(withAttribute('will', { itemMax: undefined }))).toContain(
      'attribute will is implemented but has no itemMax',
    );
  });

  it('bounds a unique by itemMax, also for an attribute without totalCap', () => {
    const uniques = [
      { ...TOKEN_UNIQUES[0], type: 'sword', attributes: [{ key: 'will', value: 41 }] },
    ];
    expect(uniqueContentFailures(uniques)).toContain(
      `unique ${TOKEN_UNIQUES[0].key}: Attribute will value 41 is above its itemMax 40`,
    );
  });

  it('checks type base plus token values against totalCap, read from content', () => {
    const raised = { ...TOKEN_CONTENT, attributes: withAttribute('shield', { itemMax: 6 }) };
    expect(uniqueContentFailures(shieldUnique(6), raised)).toContain(
      `unique ${TOKEN_UNIQUES[0].key}: Item stat blockSides 7 is above its totalCap 6`,
    );
    expect(uniqueContentFailures(shieldUnique(5), raised)).toEqual([]);
    const wider = {
      ...TOKEN_CONTENT,
      attributes: withAttribute('shield', { itemMax: 7, totalCap: 8 }),
    };
    expect(uniqueContentFailures(shieldUnique(7), wider)).toEqual([]);
  });

  it('applies totalCap to the equipped total', () => {
    const shield = (value: number) => ({
      key: 'shield',
      token: { ...sampleToken({ type: 'shield' }), attributes: [{ key: 'shield', value }] },
    });
    expect(resolveHeroStats([shield(4), shield(4)]).blockSides).toBe(6);
  });
});

describe('AG6 F10: tiers come from MAP_TIERS', () => {
  it('names one profile per map tier and refuses a missing or extra tier', () => {
    expect(ATTRIBUTE_PROFILE_TIERS).toEqual(MAP_TIERS.map((tier) => `tier-${tier}`));
    expect(Object.keys(ATTRIBUTE_PROFILES)).toEqual([...ATTRIBUTE_PROFILE_TIERS]);
    const missing: Record<string, unknown> = { ...ATTRIBUTE_PROFILES };
    delete missing['tier-4'];
    expect(attributeProfilesSchema.safeParse(missing).success).toBe(false);
    const extra = { ...ATTRIBUTE_PROFILES, 'tier-5': ATTRIBUTE_PROFILES['tier-4'] };
    expect(attributeProfilesSchema.safeParse(extra).success).toBe(false);
    expect(mapTierSchema.safeParse(5).success).toBe(false);
    expect(MAP_TIERS.every((tier) => mapTierSchema.safeParse(tier).success)).toBe(true);
  });
});
