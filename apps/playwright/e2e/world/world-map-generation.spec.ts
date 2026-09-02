import { test } from '@fixtures';
import { OpenSilesiaMapFeature } from '@features/world/open-silesia-map.feature';
import { VerifyWorldMapFeature } from '@features/world/verify-world-map.feature';

test('Leaving camp opens a generated map with a camp anchor and the hero beside it', async () => {
  await new OpenSilesiaMapFeature().open();

  await new VerifyWorldMapFeature().verifyGeneratedAndWalkable();
});

test('The same seed produces the same generated map after a reload', async () => {
  const openSilesia = new OpenSilesiaMapFeature();
  await openSilesia.open();

  const before = await openSilesia.readDescriptor();
  await openSilesia.reload();

  await new VerifyWorldMapFeature().verifyUnchangedAfterReload(before);
});
