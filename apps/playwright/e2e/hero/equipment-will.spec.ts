import { test } from '@fixtures';
import { EquipmentWillFeature } from '@features/world/equipment-will.feature';

test.describe('equipment Will capacity', { tag: ['@hero'] }, () => {
  test('Will +5 raises capacity without refilling, clamps on removal and survives reload', async () => {
    const will = new EquipmentWillFeature();
    await will.startWithWillBonus(5);
    await will.verifyWill(50, 50);
    await will.equip();
    await will.verifyWill(50, 55);
    await will.reload();
    await will.verifyWill(50, 55);
    await will.setWill(55);
    await will.verifyWill(55, 55);
    await will.unequip();
    await will.verifyWill(50, 50);
    await will.reload();
    await will.verifyWill(50, 50);
    await will.equip();
    await will.verifyWill(50, 55);
  });

  test('Will +10 keeps a low balance when equipped and removed', async () => {
    const will = new EquipmentWillFeature();
    await will.startWithWillBonus(10, 25);
    await will.verifyWill(25, 50);
    await will.equip();
    await will.verifyWill(25, 60);
    await will.unequip();
    await will.verifyWill(25, 50);
  });
});
