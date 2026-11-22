import { availableInDimension } from '../dimensions/availability';
import type { EDimension } from '../dimensions/dimensions';
import { baseItemDefinitionSchema, type BaseItemDefinition } from './base-item';
import type { TypeRegistry, AttributeRegistry } from './registries';

export class BaseItemRegistry {
  private readonly entries: readonly BaseItemDefinition[];

  constructor(
    definitions: readonly BaseItemDefinition[],
    types: TypeRegistry,
    attributes: AttributeRegistry,
  ) {
    const keys = new Set<string>();
    this.entries = Object.freeze(
      definitions.map((raw) => {
        const entry = baseItemDefinitionSchema.parse(raw);
        if (keys.has(entry.key)) throw new Error(`Duplicate base item: ${entry.key}`);
        keys.add(entry.key);
        if (!types.has(entry.type)) throw new Error(`Unknown base item type: ${entry.type}`);
        if (types.get(entry.type).enabled === false)
          throw new Error(`Disabled base item type: ${entry.type}`);
        if (entry.attributes) {
          for (const key of entry.attributes) {
            if (!attributes.has(key)) throw new Error(`Unknown base attribute: ${key}`);
          }
          Object.freeze(entry.attributes);
        }
        if (Array.isArray(entry.sharedWith)) Object.freeze(entry.sharedWith);
        return Object.freeze(entry);
      }),
    );
  }

  hasType(type: string): boolean {
    return this.entries.some((entry) => entry.type === type);
  }

  get(key: string): BaseItemDefinition | undefined {
    return this.entries.find((entry) => entry.key === key);
  }

  forDimension(dimension: EDimension, type?: string): readonly BaseItemDefinition[] {
    return this.entries.filter(
      (entry) =>
        availableInDimension(entry, dimension) && (type === undefined || entry.type === type),
    );
  }
}
