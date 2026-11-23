import { test } from '@fixtures';
import { EquipmentWillFeature } from '@features/world/equipment-will.feature';
import { KnowledgeHallFeature } from '@features/world/knowledge-hall.feature';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { QuestBoardFeature } from '@features/world/quest-board.feature';
import { HexobjectKeys as K } from '@config/test-data';

const NO_FREE_SLOTS = /no free quest slots|вільних місць/i;
const SHORT_OF_WILL = /not enough will|не вистачає волі/i;
const START_WILL = 50;

async function openBoard() {
  await new OpenCampingMapFeature().open();
  const quests = new QuestBoardFeature();
  await quests.open();
  return quests;
}

test.describe('quest board', { tag: ['@hero'] }, () => {
  test('Replaces a claimed offer and grants the reward shown on its card', async () => {
    const quests = await openBoard();
    const offer = await quests.offer('woodcutter');
    const before = await quests.snapshot();

    await quests.verifyCardState(offer.id, 'open');
    await quests.accept(offer.id);
    await quests.verifyCardState(offer.id, 'taken');
    await quests.verifyProgress(offer.id, `0 / ${offer.goal.target}`);
    await quests.verifyReady(offer.id, false);
    await quests.setProgress(offer, offer.goal.target, true);
    await quests.verifyReady(offer.id, true);

    await quests.claim(offer.id);
    await quests.verifyNotTracked(offer.id);
    await quests.verifyCardNotOnBoard(offer.id);
    await quests.verifyReward(offer);
    await quests.verifyDoneCount(offer.templateId, 1);
    await quests.verifyRefill(before, offer.id);
    const repeat = await quests.offer('woodcutter');
    await quests.accept(repeat.id);
    await quests.verifyCardState(repeat.id, 'taken');
  });

  test('The second and third slots cost extra Will and the fourth is refused', async () => {
    const quests = await openBoard();
    const wood = await quests.offer('woodcutter');
    const stone = await quests.offer('stonebreaker');
    const scholar = await quests.offer('scholar');
    const bone = await quests.offer('bone-hunter');

    await quests.accept(wood.id);
    await quests.verifyCardState(wood.id, 'taken');
    await quests.verifyWill(START_WILL);
    await quests.accept(stone.id);
    await quests.verifyWill(START_WILL - 5);
    await quests.accept(scholar.id);
    await quests.verifyWill(START_WILL - 5 - 10);
    await quests.verifySlots(3, 3);

    await quests.accept(bone.id);
    await quests.verifyWarning(NO_FREE_SLOTS);
    await quests.verifyWill(START_WILL - 5 - 10);
    await quests.verifyNotTracked(bone.id);
  });

  test('Retires the one-time quest and pays out its exact generated equipment', async () => {
    const quests = await openBoard();
    const offer = await quests.offer('bone-hunter');
    await quests.accept(offer.id);
    await quests.setProgress(offer, offer.goal.target, true);
    await quests.claim(offer.id);

    await quests.verifyReward(offer);
    await quests.verifyDoneCount(offer.templateId, 1);
    await quests.verifyTemplateAbsent(offer.templateId);
  });

  test('Restores the exact offers, accepted quest and generated target after reload', async () => {
    const quests = await openBoard();
    const before = await quests.snapshot();
    const offer = await quests.offer('woodcutter');

    await quests.accept(offer.id);
    await quests.setProgress(offer, 3);
    await quests.reloadAndOpenAgain();

    await quests.verifySameBoard(before);
    await quests.verifyCardState(offer.id, 'taken');
    await quests.verifyProgress(offer.id, `3 / ${offer.goal.target}`);
  });

  test('Unlocks, completes and claims the pilot through the Book of Will', async () => {
    const quests = await openBoard();
    await quests.verifyTemplateAbsent('camp-lectern');
    const scholar = await quests.offer('scholar');
    await quests.accept(scholar.id);
    await quests.setProgress(scholar, scholar.goal.target, true);
    await quests.claim(scholar.id);
    await quests.verifyDoneCount(scholar.templateId, 1);
    const pilot = await quests.offer('camp-lectern');

    await quests.verifyRule(pilot.id, ['Only correct answers in the Book of Will count']);
    await quests.accept(pilot.id);
    await quests.verifyProgress(pilot.id, `0 / ${pilot.goal.target}`);
    await quests.close();

    const hall = new KnowledgeHallFeature();
    await hall.openHall();
    await hall.spendAllWill();
    await hall.startHall();
    await hall.answerQuestions(1, false);
    await hall.answerQuestions(pilot.goal.target);
    await hall.close();

    await quests.open();
    await quests.verifyReady(pilot.id, true);
    await quests.claim(pilot.id);
    await quests.verifyDoneCount(pilot.templateId, 1);
    await quests.verifyBagAmount(K.coins, scholar.rewards[0].amount + pilot.rewards[0].amount);
  });

  test('Pays server prices, preserves a taken offer and resets the price at rollover', async () => {
    const will = new EquipmentWillFeature();
    await will.startWithWillBonus(40, 50, 4);
    await will.equip();
    const quests = new QuestBoardFeature();
    await quests.open();
    const active = await quests.offer('woodcutter');
    await quests.accept(active.id);
    await quests.setProgress(active, 3);

    await will.setWill(49);
    const initial = await quests.snapshot();
    await quests.verifyRefreshPrice(50);
    await quests.refresh();
    await quests.verifyWarning(SHORT_OF_WILL);
    await quests.verifyWill(49);
    await quests.verifySameBoard(initial);

    await will.setWill(50);
    await quests.refresh();
    await quests.verifyRotation(initial, active.id, 75);
    await quests.verifyWill(0);

    await will.setWill(90);
    const first = await quests.snapshot();
    await quests.refresh();
    await quests.verifyRotation(first, active.id, 100);
    await quests.verifyWill(15);

    const second = await quests.snapshot();
    await quests.givenQuests({ previousUtcDay: true });
    await quests.reloadAndOpenAgain();
    await quests.verifyRotation(second, active.id, 50, second.dayId + 1);
    await quests.verifyRefreshPrice(50);
    await quests.verifyProgress(active.id, `3 / ${active.goal.target}`);
  });

  test.describe('desktop and touch', () => {
    test.use({ hasTouch: true });

    test('Keeps the same offers and the group layout when switching to touch', async () => {
      const quests = await openBoard();
      const wood = await quests.offer('woodcutter');
      const stone = await quests.offer('stonebreaker');
      const before = await quests.snapshot();

      await quests.verifyLayout();
      await quests.dragToActive(wood.id);
      await quests.verifyCardState(wood.id, 'taken');
      await quests.switchToTouchLayout();
      await quests.verifyLayout();
      await quests.verifySameBoard(before);
      await quests.tapToInspectAndAccept(stone.id);
      await quests.verifySlots(2, 3);
    });
  });
});
