import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { SwitchHeroBoardTabFeature } from '@features/world/switch-hero-board-tab.feature';
import { ToggleHeroBoardFeature } from '@features/world/toggle-hero-board.feature';
import { VerifyHeroBoardFeature } from '@features/world/verify-hero-board.feature';
import { VerifyInventoryFeature } from '@features/world/verify-inventory.feature';

test('Verify the hero board panel opens on the Inventory tab by default', async () => {
  await new OpenCampingMapFeature().open();

  const verifyBoard = new VerifyHeroBoardFeature();
  await verifyBoard.verifyPanelVisible();
  await verifyBoard.verifyTabActive('inventory');
  await verifyBoard.verifyPanelOpen();
  await new VerifyInventoryFeature().verifyPanelIsVisible();
});

test('Verify switching tabs shows the right content and marks the tab active', async () => {
  await new OpenCampingMapFeature().open();

  const switchTab = new SwitchHeroBoardTabFeature();
  const verifyBoard = new VerifyHeroBoardFeature();

  await switchTab.switchTo('hero');
  await verifyBoard.verifyTabNotActive('inventory');
  await verifyBoard.verifyHeroTabContentVisible();

  await switchTab.switchTo('events');
  await verifyBoard.verifyTabNotActive('hero');
  await verifyBoard.verifyHeroTabContentHidden();

  await switchTab.switchTo('inventory');
  await verifyBoard.verifyTabNotActive('events');
  await new VerifyInventoryFeature().verifyPanelIsVisible();
});

test('Verify the Skills tab is disabled and cannot become active', async () => {
  await new OpenCampingMapFeature().open();

  const switchTab = new SwitchHeroBoardTabFeature();
  const verifyBoard = new VerifyHeroBoardFeature();

  await switchTab.switchTo('hero');
  await verifyBoard.verifySkillsTabIsDisabled();
  await verifyBoard.verifyTabActive('hero');
});

test('Verify collapsing and expanding the hero board panel via the rail', async () => {
  await new OpenCampingMapFeature().open();

  const toggleBoard = new ToggleHeroBoardFeature();
  const verifyBoard = new VerifyHeroBoardFeature();

  await verifyBoard.verifyPanelOpen();

  await toggleBoard.collapse();
  await toggleBoard.expand();
  await verifyBoard.verifyPanelOpen();
});
