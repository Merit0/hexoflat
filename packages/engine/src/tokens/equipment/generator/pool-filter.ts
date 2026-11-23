import type { AttributeRegistry } from '../../registries';
import type { EquipmentAttributeDefinition } from '../equipment-attribute-schema';
import { attributeGeneratable } from '../equipment-content-rules';
import type { IAttributePoolFilter, PoolEntry, PoolRequest } from './generator-contracts';

function generatable(definition: EquipmentAttributeDefinition, request: PoolRequest): boolean {
  return attributeGeneratable(definition, { ...request.type, group: request.group });
}

export class RegistryAttributePoolFilter implements IAttributePoolFilter {
  constructor(private readonly attributes: AttributeRegistry) {}

  poolFor(request: PoolRequest): PoolEntry[] {
    const pool: PoolEntry[] = [];
    for (const [key, entry] of Object.entries(request.profile.attributes)) {
      if (request.allowedKeys && !request.allowedKeys.includes(key)) continue;
      const definition = this.attributes.has(key) ? this.attributes.get(key) : undefined;
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
