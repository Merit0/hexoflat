import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { TakeTokenFeature } from '@features/world/take-token.feature';
import { VerifyMapTileFeature } from '@features/world/verify-map-tile.feature';
import { VerifyInventoryFeature } from '@features/world/verify-inventory.feature';
import { VerifyToolActionFeature } from '@features/world/verify-tool-action.feature';
import { HexobjectKeys } from '@config/test-data';

test('Verify any Tool can be taken on the map', async () => {
  await new OpenCampingMapFeature().open();

  const verifyInventory = new VerifyInventoryFeature();
  const verifyTile = new VerifyMapTileFeature('starterAxe');

  await verifyInventory.verifyDoesNotContainItem(HexobjectKeys.axe);
  await verifyTile.verifyHoldsObject(HexobjectKeys.axe);

  await new TakeTokenFeature('starterAxe').take();

  await verifyInventory.verifyContainsItem(HexobjectKeys.axe);
  await verifyTile.verifyCleared();
  await new VerifyToolActionFeature().verifyActionNoLongerOffered();
});
