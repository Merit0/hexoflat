import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { QuestBoardFeature } from '@features/world/quest-board.feature';
import { HexobjectKeys as K } from '@config/test-data';

const NO_FREE_SLOTS = /no free quest slots|вільних місць/i;
const NOT_AT_BOARD = /next to the quest board|до дошки квестів/i;
const START_WILL = 50;
const SECOND_SLOT = 5;
const THIRD_SLOT = 10;

async function openBoard() {
  await new OpenCampingMapFeature().open();
  const quests = new QuestBoardFeature();
  await quests.open();
  return quests;
}

test.describe('quest board', { tag: ['@hero'] }, () => {
  test('Verify a repeatable quest can be taken, finished, claimed and taken again', async () => {
    const quests = await openBoard();

    await quests.verifyCardState('woodcutter', 'open');
    await quests.accept('woodcutter');
    await quests.verifyCardState('woodcutter', 'taken');
    await quests.verifyProgress('woodcutter', '0 / 10');
    await quests.verifyReady('woodcutter', false);

    await quests.givenQuests({ active: [{ questId: 'woodcutter', progress: 10, state: 'ready' }] });
    await quests.verifyReady('woodcutter', true);

    await quests.claim('woodcutter');

    await quests.verifyNotTracked('woodcutter');
    await quests.verifyBagAmount(K.axe, 5);
    await quests.verifyDoneCount('woodcutter', 1);
    await quests.verifyCardState('woodcutter', 'open');
  });

  test('Verify the second and third quest cost extra Will and the fourth is refused with a reason', async () => {
    const quests = await openBoard();

    await quests.accept('woodcutter');
    await quests.verifyWill(START_WILL);
    await quests.accept('stonebreaker');
    await quests.verifyWill(START_WILL - SECOND_SLOT);
    await quests.accept('scholar');
    await quests.verifyWill(START_WILL - SECOND_SLOT - THIRD_SLOT);
    await quests.verifySlots(3, 3);

    await quests.accept('bone-hunter');

    await quests.verifyRefusal(NO_FREE_SLOTS);
    await quests.verifyWill(START_WILL - SECOND_SLOT - THIRD_SLOT);
    await quests.verifyNotTracked('bone-hunter');
  });

  test('Verify a one-time quest disappears from the board after its reward is claimed', async () => {
    const quests = await openBoard();

    await quests.accept('bone-hunter');
    await quests.givenQuests({ active: [{ questId: 'bone-hunter', progress: 3, state: 'ready' }] });
    await quests.claim('bone-hunter');

    await quests.verifyBagAmount(K.shield, 1);
    await quests.verifyDoneCount('bone-hunter', 1);
    await quests.verifyCardNotOnBoard('bone-hunter');
  });

  test('Verify a claim away from the board is refused and the quest stays ready', async () => {
    const quests = await openBoard();

    await quests.givenQuests({ active: [{ questId: 'woodcutter', progress: 10, state: 'ready' }] });
    await quests.verifyReady('woodcutter', true);

    await quests.claimAwayFromTheBoard('woodcutter');
    await quests.verifyRefusal(NOT_AT_BOARD);
    await quests.verifyReadyMarkOnTab(true);

    await quests.verifyBagAmount(K.axe, 0);
    await quests.verifyReady('woodcutter', true);
  });

  test('Verify taken quests and their counters survive a reload', async () => {
    const quests = await openBoard();

    await quests.accept('woodcutter');
    await quests.givenQuests({ active: [{ questId: 'woodcutter', progress: 3, state: 'active' }] });
    await quests.reloadAndOpenAgain();

    await quests.verifyCardState('woodcutter', 'taken');
    await quests.verifyProgress('woodcutter', '3 / 10');
  });
});
