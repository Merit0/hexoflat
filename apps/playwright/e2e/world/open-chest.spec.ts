import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { OpenChestFeature } from '@features/world/open-chest.feature';
import { VerifyActionAlertFeature } from '@features/world/verify-action-alert.feature';
import { VerifyMapTileFeature } from '@features/world/verify-map-tile.feature';
import { HexobjectKeys } from '@config/test-data';

test('Opening a chest by hand shows a rejection alert that clears itself', async () => {
  await new OpenCampingMapFeature().open();

  const verifyTile = new VerifyMapTileFeature('stashChest');
  const verifyAlert = new VerifyActionAlertFeature();

  await verifyTile.verifyHoldsObject(HexobjectKeys.stashChest);

  await new OpenChestFeature('stashChest').open();

  await verifyAlert.verifyIsShownWithMessage('The chest is broken and cannot be opened');
  await verifyAlert.verifyAutoHides();

  // OPEN only ever rejects for now — the chest stays on the map either way.
  await verifyTile.verifyHoldsObject(HexobjectKeys.stashChest);
});
