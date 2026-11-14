import { test } from '@fixtures';
import { BattleCollectFeature } from '@features/world/battle-collect.feature';

test.describe('battle collection phase', { tag: ['@combat'] }, () => {
  test('Verify a won battle leaves graves, the hand looks through them and picks the loot up, then the hero leaves', async () => {
    const collect = new BattleCollectFeature();

    await collect.winTheBattle();
    await collect.verifyTheBoardStaysOpenWithGraves();
    await collect.lookThroughEveryGrave();
    await collect.pickUpEverythingLyingAround();
    await collect.verifyTheBagHoldsTheLoot();
    await collect.verifyEveryGraveIsExaminedAndNothingLiesAround();
    await collect.leaveTheBattle();
    await collect.verifyTheBoardIsBack();
  });

  test('Verify a reload in the middle of the collection phase resumes it with the same graves', async () => {
    const collect = new BattleCollectFeature();

    await collect.winTheBattle();
    await collect.lookThroughEveryGrave();
    await collect.reloadAndVerifyTheCollectionPhaseIsBack();
  });

  test('Verify leaving with loot still lying around asks once and cancel keeps the board', async () => {
    const collect = new BattleCollectFeature();

    await collect.winTheBattle();
    await collect.lookThroughEveryGrave();
    await collect.verifyLeavingAsksOnceWhileLootRemains();
  });
});
