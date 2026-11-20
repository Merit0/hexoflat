import type { EquipmentAttributeDefinition } from './equipment-attribute-schema';
import type { TStatAggregate } from './equipment-keys';

function aggregate(values: readonly number[], rule: TStatAggregate): number {
  if (values.length === 0) return 0;
  if (rule === 'min') return Math.min(...values);
  if (rule === 'max') return Math.max(...values);
  return values.reduce((sum, value) => sum + value, 0);
}

export function resolveStat(
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
