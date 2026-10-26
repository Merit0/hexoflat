import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { SwitchHeroBoardTabFeature } from '@features/world/switch-hero-board-tab.feature';
import { TakeTokenFeature } from '@features/world/take-token.feature';
import { DragInventoryItemFeature } from '@features/world/drag-inventory-item.feature';
import { VerifyHeroBoardFeature } from '@features/world/verify-hero-board.feature';
import { VerifyInventoryFeature } from '@features/world/verify-inventory.feature';
import { HexobjectKeys } from '@config/test-data';
import { EquipSlot } from '@config/equip-slot';

test('Hovering an item in the bag and an equipped item shows the item tooltip', async () => {
  await new OpenCampingMapFeature().open();
  const verifyInventory = new VerifyInventoryFeature();
  await verifyInventory.verifyPanelIsVisible();
  await new TakeTokenFeature('starterAxe').take();
  await verifyInventory.verifyContainsItem(HexobjectKeys.axe);

  await verifyInventory.verifyBagItemTooltip(HexobjectKeys.axe, /Axe/i);

  await new DragInventoryItemFeature().dragToEquipSlot(HexobjectKeys.axe, EquipSlot.WEAPON);
  await verifyInventory.verifyItemEquipped(HexobjectKeys.axe, EquipSlot.WEAPON);
  await verifyInventory.verifyEquippedItemTooltip(HexobjectKeys.axe, /Axe/i);
});

test('The Return Scroll tooltip shows it needs Teleport, then its Will price once learned', async () => {
  await new OpenCampingMapFeature().open();
  const verifyInventory = new VerifyInventoryFeature();
  await verifyInventory.verifyContainsItem(HexobjectKeys.returnScroll);
  await new SwitchHeroBoardTabFeature().switchTo('inventory');

  await verifyInventory.verifyBagItemTooltipWillCost(HexobjectKeys.returnScroll, 10, true);

  const board = new VerifyHeroBoardFeature();
  await board.grantSkillRank('a_crest', 1);
  await board.grantSkillRank('a_teleport', 4);
  await verifyInventory.verifyBagItemTooltipWillCost(HexobjectKeys.returnScroll, 7, false);
});
