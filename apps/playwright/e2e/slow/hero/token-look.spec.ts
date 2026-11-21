import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { QuestRunFeature } from '@features/world/quest-run.feature';
import { TokenLookFeature } from '@features/world/token-look.feature';
import { HexobjectKeys } from '@config/test-data';

const STEPS = 10;
const OLD_SWORD_TITLE = /^Guard Sword$/;

test.describe('item token look', { tag: ['@hero'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('LG-13 Verify a token taken from a chest keeps its name, sprite and attributes after a reload', async () => {
    await new OpenCampingMapFeature().open();
    const quest = new QuestRunFeature();
    await quest.openBoard();
    await quest.startFirstTrail();
    await quest.walkOnTrail(STEPS);
    await quest.openChest();
    await quest.verifyHeroOnTheEmptiedChest();
    await quest.takeStackOf(HexobjectKeys.sword);
    const look = new TokenLookFeature();
    await look.rememberBagItem(HexobjectKeys.sword);
    await look.verifyLookComesFromTheToken(HexobjectKeys.sword, OLD_SWORD_TITLE);

    await quest.reloadAndVerifyLootKept();

    await look.verifyBagItemLooksTheSame(HexobjectKeys.sword);
  });
});
