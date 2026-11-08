import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { TakePlacedItemFeature } from '@features/world/take-placed-item.feature';
import { VerifyInventoryFeature } from '@features/world/verify-inventory.feature';
import { VerifyToolActionFeature } from '@features/world/verify-tool-action.feature';
import { HexobjectKeys } from '@config/test-data';

test.describe('gather resource', { tag: ['@hero'] }, () => {
  test('Verify any Tool can be taken on the map', async () => {
    await new OpenCampingMapFeature().open();

    const verifyInventory = new VerifyInventoryFeature();
    const axe = new TakePlacedItemFeature(HexobjectKeys.axe);

    await verifyInventory.verifyDoesNotContainItem(HexobjectKeys.axe);
    await axe.place();
    await axe.verifyIsOnTheMap();

    await axe.take();

    await verifyInventory.verifyContainsItem(HexobjectKeys.axe);
    await axe.verifyIsTaken();
    await new VerifyToolActionFeature().verifyActionNoLongerOffered();
  });
});
