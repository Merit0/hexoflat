import { getHeartPoints, type HeartCell } from '../../combat/heart-points';
import { EQUIPMENT_ATTRIBUTES } from '../../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../../content/item-types.content';
import type { THexobjectKey } from '../../registry/hexobjects-registry';
import type { EquipmentAttributeDefinition } from './equipment-attribute-schema';
import type { EquipmentTypeDefinition } from './equipment-type-schema';
import { HERO_STATS, type THeroStat, type TStatAggregate } from './equipment-keys';

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

function aggregate(values: readonly number[], rule: TStatAggregate): number {
  if (values.length === 0) return 0;
  if (rule === 'min') return Math.min(...values);
  if (rule === 'max') return Math.max(...values);
  return values.reduce((sum, value) => sum + value, 0);
}

function resolveStat(
  values: readonly number[],
  definitions: readonly EquipmentAttributeDefinition[],
): number {
  const rule = definitions[0]?.aggregate ?? 'sum';
  if (definitions.some((definition) => definition.aggregate !== rule)) {
    throw new Error('Attributes of one hero stat must use the same aggregate');
  }
  const cap = Math.min(...definitions.map((definition) => definition.cap ?? Infinity));
  return Math.min(cap, aggregate(values, rule));
}

function baseValues(cell: HeartCell, registry: HeroStatRegistry): Partial<HeroStats> {
  if (!cell.token) return { maxHearts: getHeartPoints(cell.key as THexobjectKey) * 2 };
  const token = cell.token;
  const base = registry.types.find((type) => type.key === token.type)?.base;
  return {
    maxHearts: base?.hearts ?? 0,
    maxWill: base?.will ?? 0,
    blockSides: base?.blockSides ?? 0,
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
