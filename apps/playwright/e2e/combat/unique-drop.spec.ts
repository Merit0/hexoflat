import { test } from '@fixtures';
import { BattleCollectFeature } from '@features/world/battle-collect.feature';
import { HexobjectKeys } from '@config/test-data';

test.describe('unique drops of a boss', { tag: ['@combat'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('Verify a boss grave with the forced roll gives one Alien unique with its red light', async () => {
    const collect = new BattleCollectFeature();

    await collect.winTheBattleWithForcedUniqueDrops(HexobjectKeys.boneCourt);
    await collect.findTheUniqueAndVerifyItsLight({
      uniqueKey: 'last-verdict',
      tokenType: 'alien',
      light: /\/red-light\.png$/,
    });
    await collect.verifyOnlyOneUniqueAfterEveryGrave();
    await collect.pickUpTheUniqueAndVerifyTheBag();
  });
});
