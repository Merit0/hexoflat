import { test } from '@fixtures';
import { WillEconomyFeature } from '@features/world/will-economy.feature';

test.describe('will economy', { tag: ['@camp'] }, () => {
  test('A hero without Will cannot walk away from the Camp', async () => {
    await new WillEconomyFeature().verifyStuckWithoutWill();
  });

  test('A paid entrance is locked with a warning when Will is short', async () => {
    await new WillEconomyFeature().verifyPaidEntranceLocksWhenWillIsShort();
  });

  test('Walking around the Camp is free', async () => {
    await new WillEconomyFeature().verifyCampStepsAreFree();
  });

  test('Entering the cave spends its Will price and leaving it is free', async () => {
    await new WillEconomyFeature().verifyEnteringCavePaysAndLeavingIsFree(2);
  });
});
