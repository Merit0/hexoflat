import { dimensionOfTokenType } from '../dimensions/dimensions';
import { rollLootLists, tokenizeLootLists, type LootTable } from '../loot';
import { tokenSourceIdOf } from '../tokens/game-tokens';
import type { TTokenSourceKind } from '../tokens/token-keys';
import type { DropContext } from '../tokens/drop-context';
import type { TokenFactory } from '../tokens/factory/token-factory';
import type { Axial } from '../utils/hex-utils';
import type { ContainerKind, ContainerState, LootLists } from './container';
import { rollUniqueDrops, type UniqueDropOverride } from './unique-drops';

export interface ContainerTokenSource {
  seed: string;
  scope: readonly string[];
}

export interface ContainerRollInput {
  kind: ContainerKind;
  tables: readonly (LootTable | null | undefined)[];
  seed: string;
  sourceId: string;
  targetKey: string;
  dropContext: DropContext;
  tableContexts?: readonly DropContext[];
  tokenSource?: ContainerTokenSource;
  tokenFactory?: TokenFactory;
  uniqueDropOverride?: UniqueDropOverride;
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
  const rolls = input.tables.flatMap((table, index) =>
    table ? [{ table, dropContext: input.tableContexts?.[index] ?? input.dropContext }] : [],
  );
  const lists = rollLootLists(
    rolls.map(({ table }) => table),
    {
      seed: input.seed,
      sourceId: input.sourceId,
      targetKey: input.targetKey,
      dimensions: rolls.map(({ dropContext }) => dimensionOfTokenType(dropContext.tokenType)),
    },
  );
  const tokens = input.tokenSource ?? { seed: input.seed, scope: [input.sourceId] };
  const scope = [TOKEN_SOURCE_OF[input.kind], ...tokens.scope, input.targetKey] as const;
  const based = tokenizeLootLists(
    lists,
    {
      seed: tokens.seed,
      sourceId: tokenSourceIdOf(...scope),
      dropContext: input.dropContext,
      factory: input.tokenFactory,
    },
    rolls.map(({ dropContext }) => dropContext),
  );
  return based.map((list, index) => [
    ...list,
    ...rollUniqueDrops({
      table: rolls[index].table,
      mint: {
        seed: tokens.seed,
        sourceId: tokenSourceIdOf(...scope, 'unique', String(index)),
        dropContext: rolls[index].dropContext,
        factory: input.tokenFactory,
      },
      seed: input.seed,
      streamLabel: `${input.sourceId}:${input.kind}:${input.targetKey}:${index}`,
      override: input.uniqueDropOverride,
    }),
  ]);
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
