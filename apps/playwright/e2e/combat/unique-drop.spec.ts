import { test } from '@fixtures';
import { BattleCollectFeature } from '@features/world/battle-collect.feature';
import { HexobjectKeys } from '@config/test-data';

const KING_UNIQUES = [
  { uniqueKey: 'lantern-eater', tokenType: 'gloom', light: /\/violet-light\.png$/ },
  { uniqueKey: 'last-verdict', tokenType: 'alien', light: /\/red-light\.png$/ },
];

test.describe('unique drops of a boss', { tag: ['@combat'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('Verify the king grave with forced rolls gives one named unique and one Alien with their lights', async () => {
    const collect = new BattleCollectFeature();

    await collect.winTheBattleWithForcedUniqueDrops(HexobjectKeys.boneCourt);
    await collect.findTheUniquesAndVerifyTheirLight(KING_UNIQUES);
    await collect.verifyNoMoreUniquesAfterEveryGrave(KING_UNIQUES);
    await collect.pickUpTheUniqueAndVerifyTheBag('last-verdict');
  });
});
