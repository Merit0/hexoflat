import { describe, expect, it, vi } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { TOKEN_PRICE_RANGES } from '../content/token-prices.content';
import { EDimension } from '../dimensions/dimensions';
import { deriveStream } from '../utils/random-seeded';
import { questRewardProfileFailures, rollQuestReward } from './quest-generation-rewards';
import { counting } from './quest-test-setup';

vi.mock('../content/base-items.content', async (importOriginal) => {
  const original = await importOriginal<typeof import('../content/base-items.content')>();
  const shared = new Set(['heaven-sword', 'earth-shield']);
  const replaced = new Set(['underworld-sword', 'underworld-shield']);
  return {
    ...original,
    BASE_ITEMS: original.BASE_ITEMS.filter(({ key }) => !replaced.has(key)).map((base) =>
      shared.has(base.key) ? { ...base, sharedWith: 'all' as const } : base,
    ),
  };
});

const CAVE_QUEST = counting('shared-reward', 'TEST', 1, { locations: ['cave'] });

const profile = (itemKey: 'sword' | 'shield', maxSellValue: number) => ({
  maxSellValue,
  entries: [{ itemKey, weight: 1, amount: [1, 1] as [number, number] }],
});

describe('D4: a shared base reward is priced by the dimension of the token (DA5a2-2)', () => {
  it('does not use the higher price range of a HEAVEN owner', () => {
    expect(TOKEN_PRICE_RANGES[ETokenType.GLOOM]).toEqual([60, 800]);
    expect(TOKEN_PRICE_RANGES[ETokenType.SPARK]).toEqual([100, 1200]);
    expect(questRewardProfileFailures(CAVE_QUEST, profile('sword', 320))).toEqual([]);
  });

  it('does not use the lower price range of an EARTH owner', () => {
    expect(TOKEN_PRICE_RANGES[ETokenType.IDOL]).toEqual([40, 600]);
    expect(questRewardProfileFailures(CAVE_QUEST, profile('shield', 300))).toEqual([
      'shield needs a coin fallback for items over budget',
    ]);
    expect(questRewardProfileFailures(CAVE_QUEST, profile('shield', 320))).toEqual([]);
  });

  it('rolls the reward token in the world and price range of the location', () => {
    const [low, high] = TOKEN_PRICE_RANGES[ETokenType.GLOOM];
    const prices = Array.from({ length: 300 }, (_, index) => {
      const seed = `da5a2-shared-price-${index}`;
      const reward = rollQuestReward(profile('shield', 320), deriveStream(seed, 'reward'), {
        seed,
        sourceId: 'quest:shared',
        dropContext: { tokenType: ETokenType.GLOOM, mapTier: 4 },
      });
      if (reward.kind !== 'item') throw new Error('item expected');
      expect(reward.token).toMatchObject({
        baseKey: 'earth-shield',
        dimension: EDimension.UNDERWORLD,
        tokenType: ETokenType.GLOOM,
      });
      return reward.token!.price;
    });
    expect(Math.min(...prices)).toBeGreaterThanOrEqual(low);
    expect(Math.max(...prices)).toBeLessThanOrEqual(high);
    expect(Math.max(...prices)).toBeGreaterThan(TOKEN_PRICE_RANGES[ETokenType.IDOL][1]);
  });
});
