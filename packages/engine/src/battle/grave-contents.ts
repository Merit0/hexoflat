import { dimensionOfTokenType, tokenTypeOfDimension } from '../dimensions/dimensions';
import { createContainer, type ContainerState } from '../containers';
import { lootTableOf } from '../content/loot-tables.content';
import { rollLoot, tokenizeLootLists } from '../loot';
import type { DropContext } from '../tokens/drop-context';
import { baseTokenTypeSchema } from '../tokens/token-keys';
import { tokenSourceIdOf } from '../tokens/game-tokens';
import { deriveStream } from '../utils/random-seeded';
import type { BattleState, Grave } from './battle-state';
import { graveDimensions } from './grave-carriers';
import { graveLootSource, graveTokenSource } from './grave-token-source';
import { hexKey } from './hex-battle-geom';

/** Preserve the ordinary roll and token identities; Trophy owns a separate stream and namespace. */
export function createGraveContainer(state: BattleState, grave: Grave): ContainerState {
  const id = hexKey(grave.hex);
  const source = graveLootSource(state, id);
  const tokens = graveTokenSource(state);
  if (!state.dropContext) throw new Error('DROP_CONTEXT_REQUIRED: grave');
  const dropContext = state.dropContext;
  const tableContexts = graveDimensions(state, grave, dropContext).map(
    (dimension): DropContext => ({
      tokenType: baseTokenTypeSchema.parse(tokenTypeOfDimension(dimension)),
      mapTier: dropContext.mapTier,
    }),
  );
  const tables = grave.tables.map((table) => lootTableOf(table));
  const container = createContainer({
    id,
    kind: 'grave',
    at: grave.hex,
    tables,
    ...source,
    dropContext,
    tableContexts,
    tokenSource: tokens,
  });
  if (!grave.trophyBonuses?.some((bonus) => bonus > 0)) return container;

  const rng = deriveStream(source.seed, `${source.sourceId}:grave:${id}:trophy`);
  const rolled = tables.flatMap((table, index) => {
    if (!table) return [];
    const bonus = grave.trophyBonuses?.[index] ?? 0;
    return [
      table.entries.length > 0 && bonus > 0
        ? rollLoot(
            { ...table, rolls: [bonus, bonus], guaranteed: [] },
            rng,
            dimensionOfTokenType(tableContexts[index].tokenType),
          )
        : [],
    ];
  });
  const extra = tokenizeLootLists(
    rolled,
    {
      seed: tokens.seed,
      sourceId: tokenSourceIdOf('grave', ...tokens.scope, id, 'trophy'),
      dropContext,
    },
    tableContexts.filter((_, index) => tables[index]),
  );
  const contents = container.contents ?? [];
  return { ...container, contents: contents.map((list, index) => [...list, ...extra[index]]) };
}
