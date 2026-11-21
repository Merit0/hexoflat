import { createContainer, type ContainerState } from '../containers';
import { lootTableOf } from '../content/loot-tables.content';
import { rollLoot, tokenizeLootLists } from '../loot';
import { tokenSourceIdOf } from '../tokens/game-tokens';
import { DEFAULT_TOKEN_ORIGIN } from '../tokens/token-origin';
import { deriveStream } from '../utils/random-seeded';
import type { BattleState, Grave } from './battle-state';
import { graveLootSource, graveTokenSource } from './grave-token-source';
import { hexKey } from './hex-battle-geom';

/** Preserve the ordinary roll and token identities; Trophy owns a separate stream and namespace. */
export function createGraveContainer(state: BattleState, grave: Grave): ContainerState {
  const id = hexKey(grave.hex);
  const source = graveLootSource(state, id);
  const tokens = graveTokenSource(state);
  const origin = state.tokenOrigin ?? DEFAULT_TOKEN_ORIGIN;
  const tables = grave.tables.map((table) => lootTableOf(table));
  const container = createContainer({
    id,
    kind: 'grave',
    at: grave.hex,
    tables,
    ...source,
    origin,
    tokenSource: tokens,
  });
  if (!grave.trophyBonuses?.some((bonus) => bonus > 0)) return container;

  const rng = deriveStream(source.seed, `${source.sourceId}:grave:${id}:trophy`);
  const rolled = tables.flatMap((table, index) => {
    if (!table) return [];
    const bonus = grave.trophyBonuses?.[index] ?? 0;
    return [
      table.entries.length > 0 && bonus > 0
        ? rollLoot({ ...table, rolls: [bonus, bonus], guaranteed: [] }, rng)
        : [],
    ];
  });
  const extra = tokenizeLootLists(rolled, {
    seed: tokens.seed,
    sourceId: tokenSourceIdOf('grave', ...tokens.scope, id, 'trophy'),
    origin,
  });
  const contents = container.contents ?? [];
  return { ...container, contents: contents.map((list, index) => [...list, ...extra[index]]) };
}
