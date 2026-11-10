import type { z } from 'zod';
import { emptyInventoryState, inventoryStateSchema } from '../inventory/inventory-state';
import type { InventoryState } from '../inventory/inventory-state';
import type { TAggregateKind } from './aggregate-kinds';
import { createKnowledgeState } from '../knowledge/state';
import { emptyProgressState, progressStateSchema, type ProgressState } from './progress-state';
import { tradersForClient } from '../trade/trader-view';

export interface AggregateServerState {
  rngSeed?: string;
}

function projectProgress(state: ProgressState, server: AggregateServerState): ProgressState {
  if (!server.rngSeed) throw new Error(`Progress of ${state.knowledge.heroId} has no rngSeed`);
  return { ...state, traders: tradersForClient(state, server.rngSeed) };
}

export interface IAggregateDefinition<TState> {
  kind: TAggregateKind;
  schemaVersion: number;
  schema: z.ZodType<TState>;
  upcasters: Record<number, (old: unknown, ctx: { heroId: string }) => unknown>;
  createInitial(ctx: { heroId: string }): TState;
  project(state: TState, server: AggregateServerState): unknown;
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
  schemaVersion: 6,
  schema: progressStateSchema,
  upcasters: {
    1: (old, { heroId }) => ({
      ...(old as object),
      knowledge: createKnowledgeState(heroId),
      presence: null,
      steps: 0,
    }),
    2: (old) => ({ ...(old as object), sealedUntil: {}, portal: null }),
    3: (old) => ({ ...(old as object), health: { current: 3, bonus: 0, debt: 0 } }),
    4: (old) => ({ ...(old as object), kills: 0 }),
    5: (old) => ({ ...(old as object), trips: 0, traders: {} }),
  },
  createInitial: ({ heroId }) => emptyProgressState(heroId),
  project: projectProgress,
};

export interface AggregateStates {
  inventory: InventoryState;
  progress: ProgressState;
}

export const AGGREGATES: { [K in TAggregateKind]: IAggregateDefinition<AggregateStates[K]> } = {
  inventory: inventoryDefinition,
  progress: progressDefinition,
};

export function upcastAggregate<K extends TAggregateKind>(
  kind: K,
  storedVersion: number,
  state: unknown,
  ctx: { heroId: string },
): AggregateStates[K] {
  const definition: IAggregateDefinition<AggregateStates[K]> = AGGREGATES[kind];
  let version = storedVersion;
  let current = state;
  while (version < definition.schemaVersion) {
    const step = definition.upcasters[version];
    if (!step) throw new Error(`No upcaster for ${kind} v${version}`);
    current = step(current, ctx);
    version += 1;
  }
  return definition.schema.parse(current);
}
