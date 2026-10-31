import { test } from '@fixtures';
import { DungeonFogFeature } from '@features/world/dungeon-fog.feature';

test('Verify a generated dungeon covers its hidden hexes with the mist hex', async () => {
  test.setTimeout(120_000);

  await new DungeonFogFeature().openTheCaveAndVerifyItsMistHex();
});
