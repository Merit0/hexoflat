import { TOKEN_UNIQUES } from '../content/token-uniques.content';
import { ALIEN_UNIQUE_CHANCE_BP } from '../content/unique-rules.content';
import {
  dimensionOfTokenType,
  uniquesDropAnywhere,
  type EDimension,
} from '../dimensions/dimensions';
import type { LootDrop, LootTable } from '../loot/loot-table';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { mintUniqueToken, type TokenMint } from '../tokens/game-tokens';
import type { UniqueKey } from '../tokens/token-keys';
import { resolveUniqueDrop } from '../tokens/unique-drop';
import { pickRandom, type RandomNumberGenerator } from '../utils/random';
import { deriveStream } from '../utils/random-seeded';

const NAMED_INDEX = 0;
const ALIEN_INDEX = 1;

const SCOPE_FREE_UNIQUES: UniqueKey[] = TOKEN_UNIQUES.filter((unique) =>
  uniquesDropAnywhere(unique.dimension),
).map((unique) => unique.key);

export interface UniqueDropOverride {
  chanceBp: number;
}

export interface UniqueDropRoll {
  table: LootTable;
  mint: TokenMint;
  seed: string;
  streamLabel: string;
  override?: UniqueDropOverride;
}

export function carriesUniqueDrops(table: LootTable | null | undefined): boolean {
  return !!table && (table.alienRoll === true || (table.uniqueDrops?.length ?? 0) > 0);
}

function rollNamed(
  { table, override }: UniqueDropRoll,
  dimension: EDimension,
  rng: RandomNumberGenerator,
): UniqueKey | null {
  const rules = table.uniqueDrops ?? [];
  if (!override) return resolveUniqueDrop(rules, rng, { dimension });
  return rules.reduce<UniqueKey | null>(
    (hit, { uniqueKey }) =>
      hit ?? resolveUniqueDrop([{ uniqueKey, chanceBp: override.chanceBp }], rng, { dimension }),
    null,
  );
}

function rollAlien(
  { override }: UniqueDropRoll,
  dimension: EDimension,
  rng: RandomNumberGenerator,
): UniqueKey | null {
  const uniqueKey = pickRandom(SCOPE_FREE_UNIQUES, rng);
  if (!uniqueKey) return null;
  const chanceBp = override?.chanceBp ?? ALIEN_UNIQUE_CHANCE_BP;
  return resolveUniqueDrop([{ uniqueKey, chanceBp }], rng, { dimension });
}

export function rollUniqueDrops(input: UniqueDropRoll): LootDrop[] {
  const { table, mint } = input;
  const dimension = dimensionOfTokenType(mint.dropContext.tokenType);
  const stream = (kind: string) => deriveStream(input.seed, `${input.streamLabel}:${kind}`);
  const hits: [UniqueKey | null, number][] = [];
  if (table.uniqueDrops?.length)
    hits.push([rollNamed(input, dimension, stream('unique')), NAMED_INDEX]);
  if (table.alienRoll) hits.push([rollAlien(input, dimension, stream('alien')), ALIEN_INDEX]);
  return hits.flatMap(([uniqueKey, n]): LootDrop[] => {
    if (!uniqueKey) return [];
    const token = mintUniqueToken(mint, uniqueKey, n);
    return [{ itemKey: token.type as THexobjectKey, amount: 1, guaranteed: true, token }];
  });
}
