import { test } from '@fixtures';
import { EquipmentTrophyFeature } from '@features/world/equipment-trophy.feature';

test.describe('equipment Trophy', { tag: ['@combat'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('Verify a Trophy sword in the bag gives no bonus to the plain lethal weapon', async () => {
    const trophy = new EquipmentTrophyFeature();
    await trophy.start(2, false);
    await trophy.killAndVerify(0);
    await trophy.reloadAndVerify(0);
  });

  test('Verify Trophy +1 is captured by a real kill and the grave loot survives reload', async () => {
    const trophy = new EquipmentTrophyFeature();
    await trophy.start(1, true);
    await trophy.killAndVerify(1);
    await trophy.reloadAndVerify(1);
    await trophy.readAndVerifyLoot();
  });

  test('Verify a tier-four Trophy +2 weapon keeps its captured bonus and loot after reload', async () => {
    const trophy = new EquipmentTrophyFeature();
    await trophy.start(2, true);
    await trophy.killAndVerify(2);
    await trophy.reloadAndVerify(2);
    await trophy.readAndVerifyLoot();
  });
});
