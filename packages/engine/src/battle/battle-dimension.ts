import { assertDimensionRelation } from '../dimensions/relation';
import { BATTLE_CREATURES, BATTLE_ITEMS, BATTLE_OBJECTS } from './battle-catalogue';
import { BATTLEFIELD_BIOMES, type Battlefield } from './battlefield';

export function assertBattleDimensions(field: Battlefield, members: readonly string[]): void {
  const recipe = BATTLEFIELD_BIOMES[field.biome];
  for (const key of members) {
    const creature = BATTLE_CREATURES[key];
    if (!creature) throw new Error(`battlefield:${recipe.id}: unknown creature ${key}`);
    assertDimensionRelation(`battlefield:${recipe.id}`, 'deploy', key, creature, recipe.dimension);
    for (const item of Object.values(creature.hands)) {
      if (!item) continue;
      const definition = BATTLE_ITEMS[item];
      if (!definition) throw new Error(`creature:${key}: unknown hand item ${item}`);
      assertDimensionRelation(`creature:${key}`, 'equip', item, definition, creature.dimension);
    }
  }
  for (const key of new Set([
    ...Object.values(field.board),
    ...(field.boulders.length ? ['boulder'] : []),
  ])) {
    if (key === 'floor') continue;
    assertDimensionRelation(
      `battlefield:${recipe.id}`,
      'terrain',
      key,
      BATTLE_OBJECTS[key],
      recipe.dimension,
    );
  }
}
