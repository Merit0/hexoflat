import { test } from '@fixtures';
import { BoardExitFeature } from '@features/world/board-exit.feature';

test('Walking onto the north exit leads to the neighbouring board and back again', async () => {
  test.setTimeout(120_000);
  await new BoardExitFeature().verifyWalkOutAndBack();
});

test('A hero on the neighbouring board keeps its board and place after a reload', async () => {
  test.setTimeout(120_000);
  await new BoardExitFeature().verifyNeighbourPlaceSurvivesReload();
});
