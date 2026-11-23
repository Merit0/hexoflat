import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_PROFILES } from '../../content/attribute-profiles.content';
import { TOKEN_CONTENT, type TokenContent } from '../../content/token-content';
import { EQUIPMENT_CONTENT, equipmentContentFailures } from '../../content/validate-equipment';
import { tokenContentFailures } from '../../content/validate-tokens';
import { createTokenFactory } from '../factory/create-token-factory';
import type { EquipmentAttributeDefinition } from './equipment-attribute-schema';
import { resolveHeroStats } from './hero-stats';

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
    const attributes = withAttribute('focus', { aggregate: 'max' });
    expect(failuresWith(attributes)).toContain(
      'stat answerWillReward mixes aggregates: focus max, wisdom sum',
    );
    expect(() => resolveHeroStats([], { attributes, types: [] })).toThrow(/same aggregate/);
  });
});

describe('AG1 F8: one scope per implemented stat', () => {
  it('lets a planned attribute share a stat with another scope until it is implemented', () => {
    expect(failuresWith(withAttribute('hero-crit', {})).join('\n')).not.toMatch(/mixes scopes/);
    expect(failuresWith(withAttribute('hero-crit', { implemented: true }))).toContain(
      'stat critPoints mixes scopes: crit item, hero-crit hero',
    );
  });
});

describe('AG1 F6: silent no-ops', () => {
  it('refuses an implemented attribute that no tier profile rolls', () => {
    expect(failuresWith(withAttribute('force', { implemented: true }))).toContain(
      'attribute force is implemented but no tier profile rolls it',
    );
  });

  it('does not ask a deprecated attribute for a profile', () => {
    expect(EQUIPMENT_CONTENT.attributes.find(({ key }) => key === 'focus')?.deprecated).toBe(true);
    expect(failuresWith(withAttribute('focus', {})).join('\n')).not.toMatch(/focus is implemented/);
  });

  it('refuses a profile weight for a group whose types cannot carry the attribute', () => {
    const attributes = withAttribute('deft-hands', { groups: ['clothing', 'defense'] });
    const profiles = structuredClone(ATTRIBUTE_PROFILES);
    profiles['tier-2'].attributes['deft-hands'].weight = { clothing: 30, defense: 10 };
    expect(equipmentContentFailures({ ...EQUIPMENT_CONTENT, attributes, profiles })).toContain(
      'tier-2: attribute deft-hands has a weight for group defense, but no type there can carry it',
    );
  });

  it('refuses a shield whose two sides fields disagree', () => {
    const types = EQUIPMENT_CONTENT.types.map((type) =>
      type.key === 'shield' ? { ...type, base: { ...type.base, blockSides: 2 } } : type,
    );
    expect(equipmentContentFailures({ ...EQUIPMENT_CONTENT, types })).toContain(
      'type shield has block.sides 1 but base.blockSides 2',
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
    expect(tokenContentFailures(withBaseAllowlist('earth-sword', ['crit']))).toEqual([]);
    expect(() => createTokenFactory(withBaseAllowlist('earth-sword', ['crit']))).not.toThrow();
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
