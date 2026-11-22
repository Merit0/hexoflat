import { availableInDimension, type DimensionAvailability } from './availability';
import type { EDimension } from './dimensions';

/** Foreign relations are authored for a specific operation, never blanket ownership changes. */
export function assertDimensionRelation(
  owner: string,
  operation: string,
  key: string,
  target: DimensionAvailability | undefined,
  dimension: EDimension,
  foreignKeys: readonly string[] = [],
): void {
  if (!target) throw new Error(`${owner}: ${operation} unknown object ${key} in ${dimension}`);
  if (availableInDimension(target, dimension) || foreignKeys.includes(key)) return;
  throw new Error(
    `${owner}: ${operation} ${key} in ${dimension}; object belongs to ${target.dimension}`,
  );
}
