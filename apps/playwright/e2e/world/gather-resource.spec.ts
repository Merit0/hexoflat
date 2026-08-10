import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { VerifyCampingBoardFeature } from '@features/world/verify-camping-board.feature';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { GatherResourceFeature } from '@features/world/gather-resource.feature';
import { HexobjectKeys } from '@config/test-data';

test('Verify any Tool can be taken on the map', async () => {
  await new OpenCampingMapFeature().open();

  const gather = new GatherResourceFeature('starterAxe');
  await gather.verifyItemNotInInventory(HexobjectKeys.axe);
  await new VerifyCampingBoardFeature().verifyTokenHoldsObject('starterAxe', HexobjectKeys.axe);

  await new MoveHeroFeature().moveAdjacentTo('starterAxe');
  await gather.armHandTool();
  await gather.take();

  await gather.verifyItemInInventory(HexobjectKeys.axe);
  await gather.verifyTileCleared();
  await gather.verifyTakeActionNoLongerOffered();
});
