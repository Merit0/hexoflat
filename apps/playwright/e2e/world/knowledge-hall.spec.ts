import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { KnowledgeHallFeature } from '@features/world/knowledge-hall.feature';

test('Will depletion, emergency return, resumed Hall and capped refill', async () => {
  test.setTimeout(240_000);
  await new OpenCampingMapFeature().open();
  const knowledge = new KnowledgeHallFeature();
  await knowledge.openHall();
  await knowledge.verifyStartingWill();
  await knowledge.exhaustWorldWill();
  await knowledge.completeReturn(17);
  await knowledge.openHall();
  await knowledge.completeHall(18, 41, true);
  await knowledge.completeHall(20, 50);
  await knowledge.verifyFull();
});
