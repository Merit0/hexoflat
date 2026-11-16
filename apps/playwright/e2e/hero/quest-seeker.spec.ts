import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { QuestRunFeature } from '@features/world/quest-run.feature';

const ENTRY = 20;
const STEPS = 10;
const BACK_COST = 3;
const START_WILL = 50;
const SHORT_OF_ENTRY = ENTRY - 1;

async function openBoard() {
  await new OpenCampingMapFeature().open();
  const quest = new QuestRunFeature();
  await quest.openBoard();
  return quest;
}

async function walkToTheChest(quest: QuestRunFeature) {
  await quest.walkOnTrail(STEPS);
  await quest.verifyChestShown();
}

test.describe('Treasure Seeker', { tag: ['@hero'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('Verify the First Trail rule states its four prices and no total', async () => {
    const quest = await openBoard();

    await quest.board.verifyRule('seeker-1', [
      'Entry costs 20 Will',
      'Every step costs 1 Will',
      'step back costs 3',
      '10 steps long',
    ]);
    await quest.board.verifyCardTextAbsent('seeker-1', /total|усього|разом/i);
  });

  test('Verify the second trail is not on the board until the first is done', async () => {
    const quest = await openBoard();

    await quest.board.verifyCardNotOnBoard('seeker-2');
    await quest.board.verifyNoStartButton('seeker-2');
  });

  test('Verify START is refused with a reason when the Will is below the entry price', async () => {
    const quest = await openBoard();

    await quest.setWill(SHORT_OF_ENTRY);

    await quest.board.verifyStartDisabled('seeker-1', true);
    await quest.board.verifyShortOfWillReason('seeker-1', true);
  });

  test('Verify a clean run reaches the real chest, returns to camp and opens the next trail', async () => {
    const quest = await openBoard();

    await quest.startFirstTrail();
    await quest.verifyHintOnFirstStep();
    await quest.verifyExactlyOneHexContinues();
    await quest.verifyStepPrices(1, BACK_COST);

    await walkToTheChest(quest);
    await quest.verifyStepCounter(STEPS, STEPS);
    await quest.verifyTrailRow();
    await quest.verifyQuestResolved('treasure');
    await quest.openChest();
    await quest.verifyPhase('collect');
    await quest.returnToCamp();
    await quest.dismissResult();

    await quest.verifyFieldGone();
    await quest.board.verifyWill(START_WILL - ENTRY - STEPS);
    await quest.board.verifyDoneCount('seeker-1', 1);
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

    await quest.startFirstTrail();
    await quest.walkOnTrail(2);
    await quest.stepOffTrail();
    await quest.stepOnAnyFreshHex();
    await quest.stepBack();
    await quest.stepBack();
    await quest.board.verifyWill(START_WILL - ENTRY - 2 - 2 - BACK_COST * 2);

    await quest.walkOnTrail(STEPS - 2);
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

  test('Verify a reload keeps the run mid-walk, beside the chest and while collecting', async () => {
    const quest = await openBoard();

    await quest.startFirstTrail();
    await quest.walkOnTrail(3);
    await quest.reloadMidRun();
    await quest.walkOnTrail(STEPS - 3);
    await quest.reloadMidRun();
    await quest.openChest();
    await quest.verifyPhase('collect');
    await quest.reloadMidRun();

    await quest.verifyPhase('collect');
  });
});
