import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { ITEM_TYPES } from '../content/item-types.content';
import { EQUIPMENT_ATTRIBUTES } from '../content/equipment-attributes.content';
import { AttributeRegistry, TypeRegistry } from './registries';

describe('TypeRegistry', () => {
  const registry = new TypeRegistry(ITEM_TYPES);

  it('reads a type by key', () => {
    expect(registry.get('shield').block).toEqual({ sides: 1 });
  });

  it('refuses an unknown type', () => {
    expect(() => registry.get('dragon-lance')).toThrow(/Unknown item type/);
  });

  it('refuses a type listed twice', () => {
    expect(() => new TypeRegistry([ITEM_TYPES[0], ITEM_TYPES[0]])).toThrow(/listed twice/);
  });

  it('lists the types of a realm', () => {
    expect(registry.forRealm(ERarityKind.IDOL).map((type) => type.key)).toEqual([
      'sword',
      'shield',
      'axe',
      'pickaxe',
    ]);
    expect(registry.forRealm(ERarityKind.GOD_EXECUTOR)).toEqual([]);
  });
});

describe('AttributeRegistry', () => {
  const registry = new AttributeRegistry(EQUIPMENT_ATTRIBUTES);

  it('holds the equipment attributes with heart, will, fog, smart-step and deft-hands implemented', () => {
    expect(registry.all()).toHaveLength(EQUIPMENT_ATTRIBUTES.length);
    expect(
      registry
        .all()
        .filter((attribute) => attribute.implemented)
        .map((attribute) => attribute.key),
    ).toEqual(['heart', 'will', 'fog', 'smart-step', 'deft-hands']);
  });

  it('keeps the stub attributes readable', () => {
    expect(registry.get('smart-step').implemented).toBe(true);
    expect(registry.get('smart-step').display.icon).toBe('boots');
  });

  it('refuses an unknown key and a key listed twice', () => {
    expect(() => registry.get('luck')).toThrow(/Unknown attribute/);
    expect(() => new AttributeRegistry([EQUIPMENT_ATTRIBUTES[0], EQUIPMENT_ATTRIBUTES[0]])).toThrow(
      /listed twice/,
    );
  });
});
