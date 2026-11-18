import type { AttributeRegistry } from './registries';
import type { TMapTier } from './token-keys';
import type { TokenAttribute } from './token-schema';

export function attributeFailure(
  registry: AttributeRegistry,
  type: string,
  attribute: TokenAttribute,
  tier?: TMapTier,
): string | null {
  if (!registry.has(attribute.key)) return `Attribute ${attribute.key} is unknown`;
  const definition = registry.get(attribute.key);
  if (definition.allowedTypes?.length && !definition.allowedTypes.includes(type)) {
    return `Attribute ${attribute.key} is not allowed on type ${type}`;
  }
  if (!definition.implemented) return `Attribute ${attribute.key} is not implemented`;
  const ceiling =
    tier === undefined
      ? Math.max(...Object.values(definition.valueByTier))
      : definition.valueByTier[tier];
  if (!Number.isSafeInteger(attribute.value) || attribute.value < 1 || attribute.value > ceiling) {
    return `Attribute ${attribute.key} value ${attribute.value} is outside [1, ${ceiling}] for tier ${tier ?? 'content'}`;
  }
  return null;
}
