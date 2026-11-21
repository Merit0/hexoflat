import { test } from '@fixtures';
import { EquipmentUseFeature } from '@features/world/equipment-use.feature';

test.describe('equipment Deft Hands', { tag: ['@combat'] }, () => {
  for (const [bonus, equipped, cost] of [
    [1, false, 3],
    [1, true, 2],
    [2, true, 1],
  ] as const) {
    test(`Deft Hands ${bonus}, equipped ${equipped}: potion costs ${cost} Will`, async () => {
      const use = new EquipmentUseFeature();
      await use.start(bonus, equipped);
      await use.drinkFor(cost);
    });
  }
  test('insufficient Will disables USE without spending, healing or consuming after reload', async () => {
    const use = new EquipmentUseFeature();
    await use.start(1, true);
    await use.verifyInsufficientWill(2, 1);
    await use.drinkFor(2);
  });

  test('removing Deft Hands restores the full potion price', async () => {
    const use = new EquipmentUseFeature();
    await use.start(2, true);
    await use.verifyPrice(1);
    await use.removeDiscount();
    await use.verifyPrice(3);
    await use.drinkFor(3);
  });

  test('replacing Deft Hands updates the price and keeps the stronger discount after reload', async () => {
    const use = new EquipmentUseFeature();
    await use.start(1, true, 2);
    await use.verifyPrice(2);
    await use.replaceDiscount();
    await use.verifyPrice(1);
    await use.reload();
    await use.drinkFor(1);
  });
});
