import { test } from '@fixtures';
import { EquipmentBlockFeature } from '@features/world/equipment-block.feature';
import { EquipSlot } from '@config/equip-slot';

test.describe('equipment Block sides', { tag: ['@combat'] }, () => {
  test('Verify a Block shield in the bag leaves one base block side', async () => {
    const block = new EquipmentBlockFeature();
    await block.start(2, false);
    await block.raiseShields(1);
    await block.reloadAndVerify(1);
  });
  test('Verify Block +1 grants two sides, enforces the limit and survives reload', async () => {
    const block = new EquipmentBlockFeature();
    await block.start(1, true);
    await block.raiseShields(2);
    await block.reloadAndVerify(2);
  });
  test('Verify a Block +1 shield in the right hand grants the same two sides and survives reload', async () => {
    const block = new EquipmentBlockFeature();
    await block.start(1, true, EquipSlot.WEAPON);
    await block.raiseShields(2);
    await block.reloadAndVerify(2);
  });
  test('Verify Block +2 grants three sides and replacement restores the base', async () => {
    const block = new EquipmentBlockFeature();
    await block.start(2, true);
    await block.raiseShields(3);
    await block.reloadAndVerify(3);
    await block.replaceWithPlainShield();
    await block.raiseShields(1);
  });
  test('Verify tier-4 Block +4 grants five sides and refuses a sixth and survives reload', async () => {
    const block = new EquipmentBlockFeature();
    await block.start(4, true);
    await block.raiseShields(5);
    await block.reloadAndVerify(5);
  });
});
