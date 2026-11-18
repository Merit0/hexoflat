import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from './item-types.content';
import { CONTENT } from './content-map';
import type { THexobjectKey } from '../registry/hexobjects-registry';

const ITEM_TYPE_FIELDS_IN_DEFINITIONS: Record<string, readonly string[]> = {
  'block.sides': ['equipment.shields', 'tool.shields'],
  slot: ['equip.slot'],
  strike: ['weapon.damageMin', 'weapon.damageMax'],
  'tool.action': ['tool.capabilities.canCut', 'tool.capabilities.canMine'],
};

const STILL_READ_UNTIL_LG5D = [
  'equip.slot',
  'weapon.damageMin',
  'weapon.damageMax',
  'tool.capabilities.canCut',
  'tool.capabilities.canMine',
];

function valueAt(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      source,
    );
}

function overlappingPaths(key: string): string[] {
  const definition = CONTENT[key as THexobjectKey];
  return Object.values(ITEM_TYPE_FIELDS_IN_DEFINITIONS)
    .flat()
    .filter((path) => valueAt(definition, path) !== undefined);
}

describe('LG5d: a definition holds no field that item-types also holds', () => {
  it('no shield definition holds shields, the sides come from item-types block.sides', () => {
    for (const type of ITEM_TYPES) {
      expect(overlappingPaths(type.key)).not.toContain('equipment.shields');
      expect(overlappingPaths(type.key)).not.toContain('tool.shields');
    }
  });

  it('only the fields still read by the old rules remain in a definition', () => {
    const remaining = new Set(ITEM_TYPES.flatMap((type) => overlappingPaths(type.key)));
    expect([...remaining].sort()).toEqual([...STILL_READ_UNTIL_LG5D].sort());
  });
});
