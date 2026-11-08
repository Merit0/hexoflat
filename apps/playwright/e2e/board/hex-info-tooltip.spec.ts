import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { HexInfoTooltipFeature } from '@features/world/hex-info-tooltip.feature';
import { HexobjectKeys } from '@config/test-data';

test.describe('hex hover card', { tag: ['@board'] }, () => {
  test('Hovering an item on the map shows its name and kind', async () => {
    await new OpenCampingMapFeature().open();
    const hexInfo = new HexInfoTooltipFeature();

    await hexInfo.hoverToken('starterAxe');

    await hexInfo.verifyShowsTitleAndKind(/Axe/i);
  });

  test('The stash chest shows as broken', async () => {
    await new OpenCampingMapFeature().open();
    const hexInfo = new HexInfoTooltipFeature();

    await hexInfo.hoverToken('stashChest');

    await hexInfo.verifySealState('broken');
  });

  test('A working construction shows as interactable', async () => {
    await new OpenCampingMapFeature().open();
    const hexInfo = new HexInfoTooltipFeature();

    await hexInfo.hoverFirstHexWithKey(HexobjectKeys.fireplace);

    await hexInfo.verifySealState('interactable');
  });

  test('An item shows its icon and rarity, and the divider gem follows the rarity', async () => {
    await new OpenCampingMapFeature().open();
    const hexInfo = new HexInfoTooltipFeature();

    await hexInfo.hoverToken('starterAxe');

    await hexInfo.verifyShowsItemIconAndRarity(/Idol/i);
  });

  test('An object without rarity shows neither an icon nor a rarity', async () => {
    await new OpenCampingMapFeature().open();
    const hexInfo = new HexInfoTooltipFeature();

    await hexInfo.hoverFirstHexWithKey(HexobjectKeys.fireplace);

    await hexInfo.verifyHasNoIconAndNoRarity();
  });

  test('The card disappears when the pointer leaves the board', async () => {
    await new OpenCampingMapFeature().open();
    const hexInfo = new HexInfoTooltipFeature();
    await hexInfo.hoverToken('starterAxe');
    await hexInfo.verifyShowsTitleAndKind(/Axe/i);

    await hexInfo.leaveTheBoard();

    await hexInfo.verifyIsHidden();
  });
});
