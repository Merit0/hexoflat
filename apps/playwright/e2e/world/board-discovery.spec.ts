import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { VerifyBoardDiscoveryFeature } from '@features/world/verify-board-discovery.feature';

test('Verify a revealed tile reports the four-state DISCOVERED, not the old boolean', async () => {
  await new OpenCampingMapFeature().open();

  await new VerifyBoardDiscoveryFeature().verifyRevealedMapReadsAsDiscovered();
});

test('Verify a fully revealed map still puts every hex of its grid on screen', async () => {
  await new OpenCampingMapFeature().open();

  await new VerifyBoardDiscoveryFeature().verifyRevealedMapRendersEveryHex();
});

test('Verify stepping onto a hex leaves it DISCOVERED', async () => {
  await new OpenCampingMapFeature().open();

  await new VerifyBoardDiscoveryFeature().verifyDiscoverySurvivesAStep();
});
