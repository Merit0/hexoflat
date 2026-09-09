import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { SwitchHeroBoardTabFeature } from '@features/world/switch-hero-board-tab.feature';
import { ClearEventsLogFeature } from '@features/world/clear-events-log.feature';
import { VerifyEventsLogFeature } from '@features/world/verify-events-log.feature';

test('Verify the events log starts empty with a working Clear control', async () => {
  await new OpenCampingMapFeature().open();
  await new SwitchHeroBoardTabFeature().switchTo('events');

  const verifyLog = new VerifyEventsLogFeature();
  await verifyLog.verifyIsVisible();
  await verifyLog.verifyRowCount(0);
  await verifyLog.verifyClearButtonIsVisible();

  await new ClearEventsLogFeature().clear();
  await verifyLog.verifyRowCount(0);
});
