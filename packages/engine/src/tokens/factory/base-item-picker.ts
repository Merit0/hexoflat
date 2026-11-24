import { availableInDimension } from '../../dimensions/availability';
import { dimensionOfTokenType } from '../../dimensions/dimensions';
import { pickRandom, type RandomNumberGenerator } from '../../utils/random';
import type { BaseItemDefinition } from '../base-item';
import type { BaseItemRegistry } from '../base-item-registry';
import { refuseToken, type GenerationContext, type TokenResult } from './token-generation';

export function pickBaseItem(
  registry: BaseItemRegistry,
  context: GenerationContext,
  rng: RandomNumberGenerator,
): TokenResult<BaseItemDefinition> {
  const dimension = dimensionOfTokenType(context.tokenType);
  if (context.baseKey !== undefined) {
    const entry = registry.get(context.baseKey);
    if (!entry) return refuseToken('UNKNOWN_BASE_ITEM', `Unknown base item: ${context.baseKey}`);
    if (!availableInDimension(entry, dimension))
      return refuseToken(
        'BASE_ITEM_NOT_IN_DIMENSION',
        `Base item ${entry.key} belongs to ${entry.dimension}, not ${dimension}`,
      );
    if (context.type !== undefined && context.type !== entry.type)
      return refuseToken('INVALID_TOKEN', 'Base item differs from the requested type');
    return { ok: true, value: entry };
  }
  const pool = registry.forDimension(dimension, context.type);
  const entry =
    context.type !== undefined && pool.length === 1 ? pool[0] : pickRandom([...pool], rng);
  if (!entry)
    return refuseToken(
      context.type
        ? registry.hasType(context.type)
          ? 'TYPE_NOT_IN_REALM'
          : 'UNKNOWN_TYPE'
        : 'NO_TYPE_IN_REALM',
      `No base item for ${context.type ?? 'any type'} in ${dimension}`,
    );
  return { ok: true, value: entry };
}
