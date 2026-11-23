import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { QuestRunFeature } from '@features/world/quest-run.feature';

const ENTRY = 20;
const BACK_COST = 3;
const START_WILL = 50;

async function openBoard() {
  await new OpenCampingMapFeature().open();
  const quest = new QuestRunFeature();
  await quest.openBoard();
  return quest;
}

test.describe('Treasure Seeker', { tag: ['@hero'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('Verify a clean run reaches the real chest, returns to camp and opens the next trail', async () => {
    const quest = await openBoard();

    const before = await quest.board.snapshot();
    const offer = await quest.startFirstTrail();
    const steps = offer.goal.target;
    await quest.verifyHintOnFirstStep();
    await quest.verifyExactlyOneHexContinues();
    await quest.verifyStepPrices(1, BACK_COST);

    await quest.walkOnTrail(steps);
    await quest.verifyChestShown();
    await quest.verifyStepCounter(steps, steps);
    await quest.verifyTrailRow();
    await quest.verifyQuestResolved('treasure');
    await quest.board.verifyRefill(before, offer.id);
    const resolved = await quest.board.snapshot();
    await quest.openChest();
    await quest.verifyPhase('collect');
    await quest.returnToCamp();
    await quest.dismissResult();

    await quest.verifyFieldGone();
    await quest.board.verifyWill(START_WILL - ENTRY - steps);
    await quest.board.verifyDoneCount('seeker-1', 1);
    await quest.board.verifySameBoard(resolved);
    await quest.verifyNextCardOpen('seeker-2');
  });

  test('Verify the same card gives a different map on the next run', async () => {
    const quest = await openBoard();

    await quest.startFirstTrail();
    const first = await quest.snapshotOfTheStart();
    await quest.giveUp();
    await quest.dismissResult();
    await quest.startFirstTrail();

    await quest.verifyStartDiffersFrom(first);
  });

  test('Verify stepping back three times each costs three and the real chest still comes', async () => {
    const quest = await openBoard();

    const offer = await quest.startFirstTrail();
    await quest.walkOnTrail(2);
    await quest.stepOffTrail();
    await quest.stepOnAnyFreshHex();
    await quest.stepBack();
    await quest.stepBack();
    await quest.board.verifyWill(START_WILL - ENTRY - 2 - 2 - BACK_COST * 2);

    await quest.walkOnTrail(offer.goal.target - 2);
    await quest.openChest();

    await quest.verifyPhase('collect');
  });

  test('Verify running out of Will mid-trail strands the hero and returns to camp', async () => {
    const quest = await openBoard();
    await quest.setWill(ENTRY + 1);

    await quest.startFirstTrail();
    await quest.stepOnTrailUntilStranded();

    await quest.verifyResult('stranded');
    await quest.dismissResult();
    await quest.verifyFieldGone();
  });

  test('Verify giving up asks first, keeps the entry spent and goes back to camp', async () => {
    const quest = await openBoard();

    await quest.startFirstTrail();
    await quest.walkOnTrail(3);
    await quest.giveUp();
    await quest.dismissResult();

    await quest.verifyFieldGone();
    await quest.board.verifyWill(START_WILL - ENTRY - 3);
    await quest.board.verifyDoneCount('seeker-1', 0);
  });

  test('Verify a clean run reaches the chest after reload and preserves the collect phase', async () => {
    const quest = await openBoard();

    const offer = await quest.startFirstTrail();
    await quest.walkOnTrail(3);
    await quest.reloadMidRun();
    await quest.walkOnTrail(offer.goal.target - 3);
    await quest.reloadMidRun();
    await quest.openChest();
    await quest.verifyPhase('collect');
    await quest.reloadMidRun();

    await quest.verifyPhase('collect');
  });
});
