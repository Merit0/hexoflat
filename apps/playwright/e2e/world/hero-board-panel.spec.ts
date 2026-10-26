import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
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

test('Verify the Path tab opens with the bionic crest selected', async () => {
  await new OpenCampingMapFeature().open();

  await new SwitchHeroBoardTabFeature().switchTo('path');

  await new VerifyHeroBoardFeature().verifySelectedSkill(/Human Form|Людська форма/, 1, 1);
});

test('Verify sacrificing Will raises skill ranks until the Will runs out', async () => {
  await new OpenCampingMapFeature().open();

  await new SwitchHeroBoardTabFeature().switchTo('path');

  const verifyBoard = new VerifyHeroBoardFeature();
  await verifyBoard.sacrificeToSkill('b_strike', 'all', 3);
  await verifyBoard.verifySkillTreeWill(0);
  await verifyBoard.verifySacrificeUnavailable('b_strike');
  await verifyBoard.verifySacrificeUnavailable('b_guard');
});

test('Verify an expensive skill keeps its progress bar across a reload', async () => {
  await new OpenCampingMapFeature().open();
  const verifyBoard = new VerifyHeroBoardFeature();
  await verifyBoard.grantSkillRank('a_crest', 1);

  await new SwitchHeroBoardTabFeature().switchTo('path');
  await verifyBoard.selectSkill('a_teleport');
  await verifyBoard.sacrificeToSkill('a_teleport', 'small', 0);
  await verifyBoard.verifySelectedSkillProgress(15, 500);

  await new ReloadCampingMapFeature().reload();
  await new SwitchHeroBoardTabFeature().switchTo('path');
  await verifyBoard.verifySkillProgress('a_teleport', 15, 500);
});

test('Verify resetting all skills clears ranks and bars without refunding Will', async () => {
  await new OpenCampingMapFeature().open();

  await new SwitchHeroBoardTabFeature().switchTo('path');

  const verifyBoard = new VerifyHeroBoardFeature();
  await verifyBoard.verifyResetUnavailable();
  await verifyBoard.sacrificeToSkill('b_strike', 'all', 3);
  await verifyBoard.resetAllSkills();
  await verifyBoard.verifySkillNodeRankIs('b_strike', 0);
  await verifyBoard.verifySkillTreeWill(0);
  await verifyBoard.verifyResetUnavailable();
});

test('Verify a skill that is not ready yet cannot be sacrificed into and says why', async () => {
  await new OpenCampingMapFeature().open();

  await new SwitchHeroBoardTabFeature().switchTo('path');

  const verifyBoard = new VerifyHeroBoardFeature();
  await verifyBoard.verifySkillIsComingSoon('b_heavy');
  await verifyBoard.verifySkillWaitsForParents('a_teleport', /Blessing|Благословення/);
  await verifyBoard.selectSkill('a_teleport');
  await verifyBoard.verifySelectedSkill(/Teleport|Телепорт/, 0, 10);
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
  await verifyBoard.sacrificeToSkill('b_strike', 'small', 2);

  await switchTab.switchTo('hero');
  await verifyBoard.verifyAttackTileChangedFrom(before);
});

test('Verify a hand holding the Return Scroll shows its Will cost on the Hero tab', async () => {
  await new OpenCampingMapFeature().open();
  await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.returnScroll);

  const switchTab = new SwitchHeroBoardTabFeature();
  const verifyBoard = new VerifyHeroBoardFeature();

  await switchTab.switchTo('inventory');
  await new DragInventoryItemFeature().dragToEquipSlot(
    HexobjectKeys.returnScroll,
    EquipSlot.WEAPON,
  );
  await switchTab.switchTo('hero');
  await verifyBoard.verifyHandWillCost('right', 10);
  await verifyBoard.verifyHandWillCost('left', null);

  await verifyBoard.grantSkillRank('a_crest', 1);
  await verifyBoard.grantSkillRank('a_teleport', 4);
  await verifyBoard.verifyHandWillCost('right', 7);
});

test('Verify clicking a hand icon puts the held item back into the bag', async () => {
  await new OpenCampingMapFeature().open();
  await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.returnScroll);

  const switchTab = new SwitchHeroBoardTabFeature();
  const verifyBoard = new VerifyHeroBoardFeature();

  await switchTab.switchTo('inventory');
  await new DragInventoryItemFeature().dragToEquipSlot(
    HexobjectKeys.returnScroll,
    EquipSlot.WEAPON,
  );
  await switchTab.switchTo('hero');
  await verifyBoard.verifyHandHolds('right', /scroll/i);

  await verifyBoard.emptyHandByIcon('right');

  await switchTab.switchTo('inventory');
  await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.returnScroll);
});
