import { test } from '@fixtures';
import { EquipmentYieldFeature } from '@features/world/equipment-yield.feature';

test.describe('equipment Yield', { tag: ['@hero'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('Verify an axe in the bag gives no bonus, real replacement adds Yield and reload retains the item', async () => {
    const yieldBonus = new EquipmentYieldFeature();
    await yieldBonus.start('axe', 1);
    await yieldBonus.equip('plain');
    await yieldBonus.harvest('plain', 0, 1, 1);
    await yieldBonus.equip('bonus');
    await yieldBonus.harvest('bonus', 1, 3, 2);
    await yieldBonus.reload();
    await yieldBonus.harvest('bonus', 1, 2, 3);
    await yieldBonus.equip('plain');
    await yieldBonus.harvest('plain', 0, 3, 4);
  });

  test('Verify a pickaxe adds two stones but each mining action advances the quest once', async () => {
    const yieldBonus = new EquipmentYieldFeature();
    await yieldBonus.start('pickaxe', 2);
    await yieldBonus.equip('bonus');
    await yieldBonus.harvest('bonus', 2, 12, 1);
    await yieldBonus.reload();
    await yieldBonus.harvest('bonus', 2, 12, 2);
  });
});
