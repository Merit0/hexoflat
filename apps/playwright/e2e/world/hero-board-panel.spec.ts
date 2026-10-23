import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { SwitchHeroBoardTabFeature } from '@features/world/switch-hero-board-tab.feature';
import { ToggleHeroBoardFeature } from '@features/world/toggle-hero-board.feature';
import { VerifyHeroBoardFeature } from '@features/world/verify-hero-board.feature';
import { VerifyInventoryFeature } from '@features/world/verify-inventory.feature';
import { TakeTokenFeature } from '@features/world/take-token.feature';
import { DragInventoryItemFeature } from '@features/world/drag-inventory-item.feature';
import { HexobjectKeys } from '@config/test-data';
import { EquipSlot } from '@config/equip-slot';

test('Verify the hero board panel opens on the Hero tab by default', async () => {
  await new OpenCampingMapFeature().open();

  const verifyBoard = new VerifyHeroBoardFeature();
  await verifyBoard.verifyPanelVisible();
  await verifyBoard.verifyTabActive('hero');
  await verifyBoard.verifyPanelOpen();
  await verifyBoard.verifyHeroTabContentVisible();
});

test('Verify picking up an item switches the hero board to the Inventory tab', async () => {
  await new OpenCampingMapFeature().open();

  const verifyBoard = new VerifyHeroBoardFeature();
  await verifyBoard.verifyTabActive('hero');

  await new TakeTokenFeature('starterAxe').take();
  await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.axe);
  await verifyBoard.verifyTabActive('inventory');
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

test('Verify the Path tab opens the skill tree', async () => {
  await new OpenCampingMapFeature().open();

  const switchTab = new SwitchHeroBoardTabFeature();
  const verifyBoard = new VerifyHeroBoardFeature();

  await switchTab.switchTo('path');
  await verifyBoard.verifySkillTreeVisible();
  await verifyBoard.verifyTabNotActive('hero');
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

test('Verify clicking the hero hex opens the Hero tab and its Skills view', async () => {
  await new OpenCampingMapFeature().open();

  const verifyBoard = new VerifyHeroBoardFeature();
  await verifyBoard.openHeroTabFromHeroHex();
  await verifyBoard.verifyHeroTabContentVisible();

  await verifyBoard.switchDetailsTab('skills');
  await verifyBoard.verifyScoutPathCardVisible();
});

test('Verify spending Will unlocks a skill rank and the starting Will cannot buy a second one', async () => {
  await new OpenCampingMapFeature().open();

  await new SwitchHeroBoardTabFeature().switchTo('path');

  const verifyBoard = new VerifyHeroBoardFeature();
  await verifyBoard.unlockSkill('attack', 1);
  await verifyBoard.verifySkillCannotBeUnlocked('attack');
  await verifyBoard.verifySkillCannotBeUnlocked('defense');
});

test('Verify the Hero tab hearts match the hero health', async () => {
  await new OpenCampingMapFeature().open();

  await new SwitchHeroBoardTabFeature().switchTo('hero');
  await new VerifyHeroBoardFeature().verifyHeartsMatchHealth();
});

test('Verify the hands show empty, then the equipped item, then empty again after unequipping', async () => {
  await new OpenCampingMapFeature().open();
  await new TakeTokenFeature('starterAxe').take();
  await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.axe);

  const switchTab = new SwitchHeroBoardTabFeature();
  const verifyBoard = new VerifyHeroBoardFeature();
  const dragItem = new DragInventoryItemFeature();

  await switchTab.switchTo('hero');
  await verifyBoard.verifyHandEmpty('right');
  await verifyBoard.verifyHandEmpty('left');

  await switchTab.switchTo('inventory');
  await dragItem.dragToEquipSlot(HexobjectKeys.axe, EquipSlot.WEAPON);
  await switchTab.switchTo('hero');
  await verifyBoard.verifyHandHolds('right', /axe/i);
  await verifyBoard.verifyHandEmpty('left');

  await switchTab.switchTo('inventory');
  await dragItem.dragEquippedToGridSlot(HexobjectKeys.axe, 'r0c1');
  await switchTab.switchTo('hero');
  await verifyBoard.verifyHandEmpty('right');
});

test('Verify unlocking an attack skill rank raises the attack shown on the Hero tab', async () => {
  await new OpenCampingMapFeature().open();

  const switchTab = new SwitchHeroBoardTabFeature();
  const verifyBoard = new VerifyHeroBoardFeature();

  await switchTab.switchTo('hero');
  const before = await verifyBoard.readAttackTileText();

  await switchTab.switchTo('path');
  await verifyBoard.unlockSkill('attack', 1);

  await switchTab.switchTo('hero');
  await verifyBoard.verifyAttackTileChangedFrom(before);
});
