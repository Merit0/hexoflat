import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { QuestRunFeature } from '@features/world/quest-run.feature';

const STEPS = 10;

async function reachTheLostTreasure() {
  await new OpenCampingMapFeature().open();
  const quest = new QuestRunFeature();
  await quest.openBoard();
  await quest.startFirstTrail();
  await quest.walkOnTrail(STEPS - 2);
  await quest.stepOffTrail();
  await quest.followAFalseTrailUntilTheTreasureIsLost();
  await quest.verifyTheTreasureIsLost();
  return quest;
}

test.describe('Treasure Seeker lost treasure', { tag: ['@hero'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('Verify one wrong turn ends in a lost treasure, leaving gives no loot and no refund', async () => {
    const quest = await reachTheLostTreasure();
    const bag = await quest.readBag();
    const will = await quest.readWill();

    await quest.leaveTheLostMap();
    await quest.dismissResult();

    await quest.verifyFieldGone();
    await quest.verifyBagIs(bag);
    await quest.verifyWillIs(will);
    await quest.board.verifyDoneCount('seeker-1', 0);
  });

  test('Verify a reload in the lost phase keeps the lost state', async () => {
    const quest = await reachTheLostTreasure();

    await quest.reloadMidRun();

    await quest.verifyTheTreasureIsLost();
  });
});
