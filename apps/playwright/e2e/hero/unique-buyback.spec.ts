import { test } from '@fixtures';
import { UniqueBuybackFeature } from '@features/world/unique-buyback.feature';

test.describe('buy-back of a sold unique', { tag: ['@hero'] }, () => {
  test('DA5c-6: a unique sold to the trader is bought back for the coins of the sale', async () => {
    const buyback = new UniqueBuybackFeature();
    await buyback.openStallWithUnique('lantern-eater');
    await buyback.verifySectionHidden();

    await buyback.sell();
    await buyback.verifyOfferedForTheSalePrice();
    await buyback.reopenAfterReload();
    await buyback.verifyOfferedForTheSalePrice();

    await buyback.buyBack();
    await buyback.verifyOwnedAgain();
    await buyback.verifySectionHidden();
  });
});
