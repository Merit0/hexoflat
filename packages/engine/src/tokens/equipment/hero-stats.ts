import { getHeartPoints, type HeartCell } from '../../combat/heart-points';
import { EQUIPMENT_ATTRIBUTES } from '../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../content/item-types.content';
import type { THexobjectKey } from '../../registry/hexobjects-registry';
import type { EquipmentAttributeDefinition } from './equipment-attribute-schema';
import type { EquipmentTypeDefinition } from './equipment-type-schema';
import { HERO_STATS, type THeroStat } from './equipment-keys';
import { resolveStat } from './stat-values';

/** Equipment bonuses, in content units (maxHearts is measured in half-hearts). */
export type HeroStats = Record<THeroStat, number>;

export interface HeroStatRegistry {
  attributes: readonly EquipmentAttributeDefinition[];
  types: readonly EquipmentTypeDefinition[];
}

const DEFAULT_REGISTRY: HeroStatRegistry = {
  attributes: EQUIPMENT_ATTRIBUTES,
  types: EQUIPMENT_TYPES,
};

function baseValues(cell: HeartCell, registry: HeroStatRegistry): Partial<HeroStats> {
  const type = registry.types.find((type) => type.key === (cell.token?.type ?? cell.key));
  const base = type?.base;
  if (!cell.token)
    return {
      maxHearts: getHeartPoints(cell.key as THexobjectKey) * 2,
      blockSides: type?.block?.sides ?? base?.blockSides ?? 0,
    };
  return {
    maxHearts: base?.hearts ?? 0,
    maxWill: base?.will ?? 0,
    blockSides: type?.block?.sides ?? base?.blockSides ?? 0,
  };
}

export function resolveHeroStats(
  equipped: ReadonlyArray<HeartCell | null | undefined>,
  registry: HeroStatRegistry = DEFAULT_REGISTRY,
): HeroStats {
  const definitions = registry.attributes.filter(
    (definition) =>
      definition.implemented && definition.scope === 'hero' && definition.stat !== null,
  );
  const values = new Map<THeroStat, number[]>();
  const add = (stat: THeroStat, value: number) => {
    const entries = values.get(stat) ?? [];
    entries.push(value);
    values.set(stat, entries);
  };
  for (const cell of equipped) {
    if (!cell) continue;
    for (const [stat, value] of Object.entries(baseValues(cell, registry))) {
      if (value > 0) add(stat as THeroStat, value);
    }
    for (const attribute of cell.token?.attributes ?? []) {
      const definition = definitions.find((candidate) => candidate.key === attribute.key);
      if (definition?.stat) add(definition.stat, attribute.value);
    }
  }
  return Object.fromEntries(
    HERO_STATS.map((stat) => [
      stat,
      resolveStat(
        values.get(stat) ?? [],
        definitions.filter((definition) => definition.stat === stat),
      ),
    ]),
  ) as HeroStats;
}
