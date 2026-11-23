import { availableInDimension } from '../dimensions/availability';
import type { EDimension } from '../dimensions/dimensions';
import {
  equipmentAttributeDefinitionSchema,
  type EquipmentAttributeDefinition,
} from './equipment/equipment-attribute-schema';
import { itemTypeDefinitionSchema, type ItemTypeDefinition } from './token-content-schema';
import type { AttributeKey, ItemTypeKey, UniqueKey } from './token-keys';
import { uniqueTokenDefinitionSchema, type UniqueTokenDefinition } from './unique-schema';

function freezeContent<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeContent(child);
    Object.freeze(value);
  }
  return value;
}

function indexByKey<T extends { key: string }>(
  kind: string,
  entries: readonly T[],
): Map<string, T> {
  const byKey = new Map<string, T>();
  for (const entry of entries) {
    if (byKey.has(entry.key)) throw new Error(`${kind} "${entry.key}" is listed twice`);
    byKey.set(entry.key, freezeContent(entry));
  }
  return byKey;
}

export class TypeRegistry {
  private readonly byKey: ReadonlyMap<string, ItemTypeDefinition>;

  constructor(definitions: readonly ItemTypeDefinition[]) {
    this.byKey = indexByKey(
      'Item type',
      definitions.map((definition) => itemTypeDefinitionSchema.parse(definition)),
    );
  }

  has(key: ItemTypeKey): boolean {
    return this.byKey.has(key);
  }

  get(key: ItemTypeKey): ItemTypeDefinition {
    const definition = this.byKey.get(key);
    if (!definition) throw new Error(`Unknown item type "${key}"`);
    return definition;
  }

  all(): readonly ItemTypeDefinition[] {
    return [...this.byKey.values()];
  }
}

export class AttributeRegistry {
  private readonly byKey: ReadonlyMap<string, EquipmentAttributeDefinition>;

  constructor(definitions: readonly EquipmentAttributeDefinition[]) {
    this.byKey = indexByKey(
      'Attribute',
      definitions.map((definition) => equipmentAttributeDefinitionSchema.parse(definition)),
    );
  }

  has(key: AttributeKey): boolean {
    return this.byKey.has(key);
  }

  get(key: AttributeKey): EquipmentAttributeDefinition {
    const definition = this.byKey.get(key);
    if (!definition) throw new Error(`Unknown attribute "${key}"`);
    return definition;
  }

  all(): readonly EquipmentAttributeDefinition[] {
    return [...this.byKey.values()];
  }
}

export class UniqueRegistry {
  private readonly byKey: ReadonlyMap<string, UniqueTokenDefinition>;

  constructor(definitions: readonly UniqueTokenDefinition[]) {
    this.byKey = indexByKey(
      'Unique',
      definitions.map((definition) => uniqueTokenDefinitionSchema.parse(definition)),
    );
  }

  has(key: UniqueKey): boolean {
    return this.byKey.has(key);
  }

  get(key: UniqueKey): UniqueTokenDefinition {
    const definition = this.byKey.get(key);
    if (!definition) throw new Error(`Unknown unique "${key}"`);
    return definition;
  }

  forDimension(dimension: EDimension): readonly UniqueTokenDefinition[] {
    return this.all().filter((entry) => availableInDimension(entry, dimension));
  }

  all(): readonly UniqueTokenDefinition[] {
    return [...this.byKey.values()];
  }
}
