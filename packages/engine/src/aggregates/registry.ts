import type { z } from 'zod';
import { emptyInventoryState, inventoryStateSchema } from '../inventory/inventory-state';
import type { InventoryState } from '../inventory/inventory-state';
import type { TAggregateKind } from './aggregate-kinds';
import { emptyProgressState, progressStateSchema, type ProgressState } from './progress-state';

export interface IAggregateDefinition<TState> {
  kind: TAggregateKind;
  schemaVersion: number;
  schema: z.ZodType<TState>;
  upcasters: Record<number, (old: unknown) => unknown>;
  createInitial(ctx: { heroId: string }): TState;
  project(state: TState): unknown;
}

const inventoryDefinition: IAggregateDefinition<InventoryState> = {
  kind: 'inventory',
  schemaVersion: 1,
  schema: inventoryStateSchema as unknown as z.ZodType<InventoryState>,
  upcasters: {},
  createInitial: ({ heroId }) => emptyInventoryState(heroId),
  project: (state) => state,
};

const progressDefinition: IAggregateDefinition<ProgressState> = {
  kind: 'progress',
  schemaVersion: 1,
  schema: progressStateSchema,
  upcasters: {},
  createInitial: () => emptyProgressState(),
  project: (state) => state,
};

export interface AggregateStates {
  inventory: InventoryState;
  progress: ProgressState;
}

export const AGGREGATES: { [K in TAggregateKind]: IAggregateDefinition<AggregateStates[K]> } = {
  inventory: inventoryDefinition,
  progress: progressDefinition,
};

/** Runs a stored document through the upcasters up to the current schema version. */
export function upcastAggregate<K extends TAggregateKind>(
  kind: K,
  storedVersion: number,
  state: unknown,
): AggregateStates[K] {
  const definition: IAggregateDefinition<AggregateStates[K]> = AGGREGATES[kind];
  let version = storedVersion;
  let current = state;
  while (version < definition.schemaVersion) {
    const step = definition.upcasters[version];
    if (!step) throw new Error(`No upcaster for ${kind} v${version}`);
    current = step(current);
    version += 1;
  }
  return definition.schema.parse(current);
}
