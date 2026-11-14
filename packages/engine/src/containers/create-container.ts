import { rollLootLists, type LootTable } from '../loot';
import type { Axial } from '../utils/hex-utils';
import type { ContainerKind, ContainerState } from './container';

export interface CreateContainerInput {
  id: string;
  kind: ContainerKind;
  at: Axial;
  tables: readonly (LootTable | null | undefined)[];
  seed: string;
  sourceId: string;
  targetKey: string;
}

export function createContainer(input: CreateContainerInput): ContainerState {
  return {
    id: input.id,
    kind: input.kind,
    at: { ...input.at },
    contents: rollLootLists(input.tables, {
      seed: input.seed,
      sourceId: input.sourceId,
      targetKey: input.targetKey,
    }),
    status: 'full',
  };
}
