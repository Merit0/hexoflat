import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { QuestRunFeature } from '@features/world/quest-run.feature';

const STEPS = 10;

async function reachTheOpenedChest() {
  await new OpenCampingMapFeature().open();
  const quest = new QuestRunFeature();
  await quest.openBoard();
  await quest.startFirstTrail();
  await quest.walkOnTrail(STEPS);
  await quest.openChest();
  await quest.verifyHeroOnTheEmptiedChest();
  return quest;
}

test.describe('Treasure Seeker chest loot', { tag: ['@hero'] }, () => {
  test('Verify a clean run: open the chest, take all, return, loot in the bag and the next card open', async () => {
    const quest = await reachTheOpenedChest();

    await quest.takeEveryStack();
    await quest.returnToCamp();
    await quest.dismissResult();

    await quest.verifyFieldGone();
    await quest.board.verifyDoneCount('seeker-1', 1);
    await quest.verifyNextCardOpen('seeker-2');
  });

  test('Verify a reload on the chest hex and in the middle of collecting keeps the loot', async () => {
    const quest = await reachTheOpenedChest();

    await quest.reloadAndVerifyLootKept();
    await quest.takeOneStack();
    await quest.stepOffTheChest();
    await quest.reloadAndVerifyLootKept();
  });

  test('Verify an object is used only with the hand, a mouse click on the chest does nothing', async () => {
    const quest = await reachTheOpenedChest();

    await quest.clickTheChestWithTheMouse();
    await quest.takeOneStack();
  });
});
