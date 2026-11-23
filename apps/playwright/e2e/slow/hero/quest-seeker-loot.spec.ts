import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { QuestRunFeature } from '@features/world/quest-run.feature';
import { RenderHealthFeature } from '@features/world/render-health.feature';

async function reachTheOpenedChest() {
  await new OpenCampingMapFeature().open();
  const quest = new QuestRunFeature();
  await quest.openBoard();
  const offer = await quest.startFirstTrail();
  await quest.walkOnTrail(offer.goal.target);
  await quest.openChest();
  await quest.verifyHeroOnTheEmptiedChest();
  return quest;
}

test.describe('Treasure Seeker chest loot', { tag: ['@hero'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('Verify an overweight sword pickup warns and keeps the loot and hand', async () => {
    const quest = await reachTheOpenedChest();
    await quest.verifyOverweightSwordPickupWarning();
  });
  test('Verify three consecutive complete runs on the same hero', async () => {
    test.setTimeout(300_000);
    await new OpenCampingMapFeature().open();
    const quest = new QuestRunFeature();
    await quest.openBoard();

    for (let run = 1; run <= 3; run += 1) {
      await test.step(`Complete run ${run} of 3`, async () => {
        await quest.setWill(50);
        await quest.emptyTheBag();
        const offer = await quest.startFirstTrail();
        await quest.walkOnTrail(offer.goal.target);
        await quest.openChest();
        await quest.verifyHeroOnTheEmptiedChest();
        await quest.takeEveryStack();
        await quest.returnToCamp();
        await quest.dismissResult();
        await quest.verifyFieldGone();
        await quest.board.verifyDoneCount('seeker-1', run);
        await quest.board.verifyWill(50 - 20 - offer.goal.target);
        await quest.verifyNextCardOpen('seeker-2');
      });
    }
  });

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

  test('Verify returning to camp while the chest loot still flies leaves a clean world board', async () => {
    await new OpenCampingMapFeature().open();
    const render = new RenderHealthFeature();
    await render.recordTheIdleWorldBoard();
    const quest = new QuestRunFeature();
    await quest.openBoard();
    const offer = await quest.startFirstTrail();
    await quest.walkOnTrail(offer.goal.target);
    await quest.openTheChestAndReturnWhileTheLootFlies();
    await quest.dismissResult();
    await quest.verifyFieldGone();
    await render.verifyTheWorldBoardIsClean();
  });
});
