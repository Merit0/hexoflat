import { test } from '@fixtures';
import { DungeonExitFeature } from '@features/world/dungeon-exit.feature';

test.describe('dungeon exit placement', { tag: ['@board'] }, () => {
  test('Verify Hero is always allocated near the dungeon entrance when made exit dungeon using exit dungeon case', async () => {
    test.setTimeout(120_000);
    await new DungeonExitFeature().verifyRepeatedExitsReturnBesideTheEntrance();
  });
});
