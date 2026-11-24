import { test } from '@fixtures';
import { EquipmentCritFeature } from '@features/world/equipment-crit.feature';
import { EquipSlot } from '@config/equip-slot';

test.describe('weapon critical strikes', { tag: ['@combat'] }, () => {
  test('Verify critical gear in the bag does not affect a plain weapon', async () => {
    const crit = new EquipmentCritFeature();
    await crit.start(5, false);
    await crit.strikeAndReload(true, 4);
  });
  test('Verify tier-1 +2% uses the default x2 critical damage', async () => {
    const crit = new EquipmentCritFeature();
    await crit.start(2, true);
    await crit.strikeAndReload(true, 4);
  });
  test('Verify +10% and x3 work through real equipment and survive reload', async () => {
    const crit = new EquipmentCritFeature();
    await crit.start(3, true);
    await crit.strikeAndReload(true, 6);
  });
  test('Verify a critical sword in the left hand strikes the same as in the right', async () => {
    const crit = new EquipmentCritFeature();
    await crit.start(3, true, EquipSlot.SHIELD);
    await crit.strikeAndReload(true, 6);
  });
  test('Verify x4 critical damage survives reload', async () => {
    const crit = new EquipmentCritFeature();
    await crit.start(4, true);
    await crit.strikeAndReload(true, 8);
  });
  test('Verify x5 and replacing the weapon restore the default x2 critical damage', async () => {
    const crit = new EquipmentCritFeature();
    await crit.start(5, true);
    await crit.strikeAndReload(true, 10);
    await crit.replaceWithPlainWeapon();
    await crit.strikeAndReload(true, 4);
  });
});
