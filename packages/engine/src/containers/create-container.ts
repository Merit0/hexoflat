import { rollLootLists, tokenizeLootLists, type LootTable } from '../loot';
import { tokenSourceIdOf } from '../tokens/game-tokens';
import type { TTokenSourceKind } from '../tokens/token-keys';
import type { TokenOrigin } from '../tokens/token-origin';
import type { Axial } from '../utils/hex-utils';
import type { ContainerKind, ContainerState, LootLists } from './container';

export interface ContainerRollInput {
  kind: ContainerKind;
  tables: readonly (LootTable | null | undefined)[];
  seed: string;
  sourceId: string;
  targetKey: string;
  origin: TokenOrigin;
}

export interface CreateContainerInput extends ContainerRollInput {
  id: string;
  at: Axial;
}

const TOKEN_SOURCE_OF: Record<ContainerKind, TTokenSourceKind> = {
  chest: 'chest',
  grave: 'grave',
  'quest-chest': 'quest',
};

export function rollContainerContents(input: ContainerRollInput): LootLists {
  const lists = rollLootLists(input.tables, {
    seed: input.seed,
    sourceId: input.sourceId,
    targetKey: input.targetKey,
  });
  return tokenizeLootLists(lists, {
    seed: input.seed,
    sourceId: tokenSourceIdOf(TOKEN_SOURCE_OF[input.kind], input.sourceId, input.targetKey),
    origin: input.origin,
  });
}

export function createContainer(input: CreateContainerInput): ContainerState {
  return {
    id: input.id,
    kind: input.kind,
    at: { ...input.at },
    contents: rollContainerContents(input),
    status: 'full',
  };
}
