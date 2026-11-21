import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { QuestRunFeature } from '@features/world/quest-run.feature';

const ENTRY = 20;
const SHORT_OF_ENTRY = ENTRY - 1;

async function openBoard() {
  await new OpenCampingMapFeature().open();
  const quest = new QuestRunFeature();
  await quest.openBoard();
  return quest;
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
});
