import { test } from '@fixtures';
import { DungeonFogFeature } from '@features/world/dungeon-fog.feature';
import { EquipmentFogFeature } from '@features/world/equipment-fog.feature';

test.describe('dungeon fog', { tag: ['@board'] }, () => {
  for (const bonus of [1, 2]) {
    test(`Verify sight +${bonus} works only when equipped and persists its revealed fog`, async () => {
      const fog = new EquipmentFogFeature();
      await fog.startWithSightInBag(bonus);
      await fog.stepAndVerifyRadius(1);
      await fog.equipSight();
      await fog.stepAndVerifyRadius(1 + bonus);
      await fog.reloadAndVerifyFog();
    });
  }
  test('Verify a generated dungeon covers its hidden hexes with the mist hex', async () => {
    await new DungeonFogFeature().openTheCaveAndVerifyItsMistHex();
  });

  test('Verify the cave exit is a part of the dungeon border, not in the middle', async () => {
    await new DungeonFogFeature().openTheCaveAndVerifyTheExitIsOnTheBorder();
  });
});
