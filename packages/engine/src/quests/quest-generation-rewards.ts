import { coinPriceOf } from '../content/content-accessors';
import { BASE_ITEMS } from '../content/base-items.content';
import { TOKEN_PRICE_RANGES } from '../content/token-prices.content';
import { TRADERS } from '../content/traders.content';
import { availableInDimension } from '../dimensions/availability';
import { dimensionOfTokenType, tokenTypeOfDimension } from '../dimensions/dimensions';
import { dropAvailableIn } from '../loot/dimension-pool';
import type { LootTable } from '../loot/loot-table';
import { rollLoot } from '../loot/roll-loot';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { isTokenType, mintBaseToken, type TokenMint } from '../tokens/game-tokens';
import { baseTokenTypeSchema } from '../tokens/token-keys';
import { sellPriceFrom } from '../trade/price-of';
import type { RandomNumberGenerator } from '../utils/random';
import type { QuestDefinition, Reward } from './quest-definition';
import type { QuestRewardProfile } from './quest-generation.content';
import { rewardSellValue } from './quests.content';

const coinReward = (amount: number): Reward => ({
  kind: 'item',
  itemKey: HEXOBJECT_KEYS.COINS,
  amount,
});

export function rollQuestReward(
  profile: QuestRewardProfile,
  random: RandomNumberGenerator,
  mint: TokenMint,
): Reward {
  const table: LootTable = { id: 'quest-reward', rolls: [1, 1], entries: profile.entries };
  const [drop] = rollLoot(table, random, dimensionOfTokenType(mint.dropContext.tokenType));
  const reward: Reward = { kind: 'item', itemKey: drop.itemKey, amount: drop.amount };
  if (isTokenType(drop.itemKey)) reward.token = mintBaseToken(mint, drop.itemKey, 0, drop.baseKey);
  if (rewardSellValue(reward) <= profile.maxSellValue) return reward;
  if (profile.fallbackCoins !== undefined) return coinReward(profile.fallbackCoins);
  throw new Error('QUEST_REWARD_OVER_BUDGET');
}

export function questRewardProfileFailures(
  quest: QuestDefinition,
  profile: QuestRewardProfile,
): string[] {
  const failures: string[] = [];
  const dimension = quest.rewardDropContext
    ? dimensionOfTokenType(quest.rewardDropContext.tokenType)
    : quest.dimension;
  if (profile.fallbackCoins !== undefined && profile.fallbackCoins > profile.maxSellValue) {
    failures.push('coin fallback exceeds reward budget');
  }
  for (const entry of profile.entries) {
    const { itemKey, baseKey, amount } = entry;
    const bases = BASE_ITEMS.filter(
      (base) =>
        base.type === itemKey &&
        (baseKey === undefined || baseKey === base.key) &&
        availableInDimension(base, dimension),
    );
    const needsToken = isTokenType(itemKey);
    if (needsToken || baseKey !== undefined) {
      if (!needsToken || bases.length === 0 || amount[1] !== 1) {
        failures.push(`invalid base reward ${baseKey ?? itemKey} in ${dimension}`);
        continue;
      }
      const canExceedBudget = bases.some((base) => {
        const tokenType = baseTokenTypeSchema.parse(tokenTypeOfDimension(base.dimension));
        const upperPrice = TOKEN_PRICE_RANGES[tokenType][1];
        return (sellPriceFrom(TRADERS.ilva, upperPrice) ?? 0) > profile.maxSellValue;
      });
      if (canExceedBudget && profile.fallbackCoins === undefined) {
        failures.push(`${itemKey} needs a coin fallback for items over budget`);
      }
      continue;
    }
    if (
      !dropAvailableIn(entry, dimension) ||
      (itemKey !== HEXOBJECT_KEYS.COINS && coinPriceOf(itemKey) === null) ||
      rewardSellValue({ kind: 'item', itemKey, amount: amount[1] }) > profile.maxSellValue
    ) {
      failures.push(`invalid or over-budget reward ${itemKey} in ${dimension}`);
    }
  }
  return failures;
}
