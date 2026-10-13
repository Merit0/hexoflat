import { test } from '@fixtures';
import { WillEconomyFeature } from '@features/world/will-economy.feature';

test('A hero without Will cannot walk away from the Camp and is offered the way home', async () => {
  await new WillEconomyFeature().verifyStuckWithoutWill();
});

test('A paid entrance shows its Will price and is locked when Will is short', async () => {
  test.setTimeout(120_000);
  await new WillEconomyFeature().verifyPaidEntrancePrice(2);
});
