import {
  equipmentAttributeDefinitionSchema,
  type EquipmentAttributeDefinition,
} from '../equipment-attribute-schema';
import { attributeGeneratable } from '../equipment-content-rules';
import type { IAttributePoolFilter, PoolEntry, PoolRequest } from './generator-contracts';

function indexByKey(
  attributes: readonly EquipmentAttributeDefinition[],
): ReadonlyMap<string, EquipmentAttributeDefinition> {
  const byKey = new Map<string, EquipmentAttributeDefinition>();
  for (const raw of attributes) {
    const definition = equipmentAttributeDefinitionSchema.parse(raw);
    if (byKey.has(definition.key)) {
      throw new Error(`DUPLICATE_ATTRIBUTE: ${definition.key}`);
    }
    byKey.set(definition.key, Object.freeze(definition));
  }
  return byKey;
}

function generatable(definition: EquipmentAttributeDefinition, request: PoolRequest): boolean {
  return attributeGeneratable(definition, { ...request.type, group: request.group });
}

export class RegistryAttributePoolFilter implements IAttributePoolFilter {
  private readonly attributes: ReadonlyMap<string, EquipmentAttributeDefinition>;

  constructor(attributes: readonly EquipmentAttributeDefinition[]) {
    this.attributes = indexByKey(attributes);
  }

  poolFor(request: PoolRequest): PoolEntry[] {
    const pool: PoolEntry[] = [];
    for (const [key, entry] of Object.entries(request.profile.attributes)) {
      if (request.allowedKeys && !request.allowedKeys.includes(key)) continue;
      const definition = this.attributes.get(key);
      const weight = entry.weight[request.group];
      if (!definition || weight === undefined || !generatable(definition, request)) continue;
      const requires = definition.requires?.attributes;
      pool.push({
        key,
        weight,
        min: entry.min,
        max: entry.max,
        step: entry.step,
        ...(requires ? { requires } : {}),
      });
    }
    return pool.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }
}
