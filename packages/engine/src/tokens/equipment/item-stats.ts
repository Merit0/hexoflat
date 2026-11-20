import type { HeartCell } from '../../combat/heart-points';
import { EQUIPMENT_ATTRIBUTES } from '../../content/equipment-attributes.content';
import type { EquipmentAttributeDefinition } from './equipment-attribute-schema';
import { HERO_STATS } from './equipment-keys';
import type { HeroStats } from './hero-stats';
import { resolveStat } from './stat-values';

/** Item-scoped bonuses belong only to the item performing the action. */
export function resolveItemStats(
  item: HeartCell | null | undefined,
  attributes: readonly EquipmentAttributeDefinition[] = EQUIPMENT_ATTRIBUTES,
): HeroStats {
  const implemented = attributes.filter(
    (definition) =>
      definition.implemented && definition.scope === 'item' && definition.stat !== null,
  );
  return Object.fromEntries(
    HERO_STATS.map((stat) => {
      const definitions = implemented.filter((definition) => definition.stat === stat);
      const keys = new Set(definitions.map((definition) => definition.key));
      const values = (item?.token?.attributes ?? [])
        .filter((attribute) => keys.has(attribute.key))
        .map((attribute) => attribute.value);
      return [stat, resolveStat(values, definitions)];
    }),
  ) as HeroStats;
}
