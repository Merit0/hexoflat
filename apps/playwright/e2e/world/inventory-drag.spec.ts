import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { TakeTokenFeature } from '@features/world/take-token.feature';
import { DragInventoryItemFeature } from '@features/world/drag-inventory-item.feature';
import { SwitchHeroBoardTabFeature } from '@features/world/switch-hero-board-tab.feature';
import { VerifyInventoryFeature } from '@features/world/verify-inventory.feature';
import { UseEquippedToolFeature } from '@features/world/use-equipped-tool.feature';
import { VerifyToolActionFeature } from '@features/world/verify-tool-action.feature';
import { HexobjectKeys } from '@config/test-data';
import { EquipSlot } from '@config/equip-slot';

test('Verify dragging a grid item to another grid slot moves it there', async () => {
  await new OpenCampingMapFeature().open();
  await new VerifyInventoryFeature().verifyPanelIsVisible();
  await new TakeTokenFeature('starterAxe').take();
  await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.axe);

  await new DragInventoryItemFeature().dragToGridSlot(HexobjectKeys.axe, 'r0c1');

  await new VerifyInventoryFeature().verifyItemInGridSlot(HexobjectKeys.axe, 'r0c1');
});

test('Verify the Will token sits in the inventory grid and no item can be dropped onto its cell', async () => {
  await new OpenCampingMapFeature().open();
  await new SwitchHeroBoardTabFeature().switchTo('inventory');
  const verifyInventory = new VerifyInventoryFeature();
  await verifyInventory.verifyPanelIsVisible();
  await verifyInventory.verifyWillTokenPresent();
  await new TakeTokenFeature('starterAxe').take();
  await verifyInventory.verifyContainsItem(HexobjectKeys.axe);

  const dragItem = new DragInventoryItemFeature();
  await dragItem.dragToWillCell(HexobjectKeys.axe);
  await verifyInventory.verifyWillCellStaysFree();
  await verifyInventory.verifyWillTokenPresent();

  await dragItem.dragToGridSlot(HexobjectKeys.axe, 'r0c1');
  await verifyInventory.verifyItemInGridSlot(HexobjectKeys.axe, 'r0c1');
  await verifyInventory.verifyWillTokenPresent();
});

test('Verify dragging an item onto an equip slot equips it, and dragging it back unequips it', async () => {
  await new OpenCampingMapFeature().open();
  await new VerifyInventoryFeature().verifyPanelIsVisible();
  await new TakeTokenFeature('starterAxe').take();
  await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.axe);
  const dragItem = new DragInventoryItemFeature();
  const verifyInventory = new VerifyInventoryFeature();

  await dragItem.dragToEquipSlot(HexobjectKeys.axe, EquipSlot.WEAPON);
  await verifyInventory.verifyItemEquipped(HexobjectKeys.axe, EquipSlot.WEAPON);

  await dragItem.dragEquippedToGridSlot(HexobjectKeys.axe, 'r0c1');
  await verifyInventory.verifyItemInGridSlot(HexobjectKeys.axe, 'r0c1');
});

test('Verify unequipping the tool in use removes the tool hex from the map', async () => {
  await new OpenCampingMapFeature().open();
  await new TakeTokenFeature('starterAxe').take();
  const verifyInventory = new VerifyInventoryFeature();
  await verifyInventory.verifyContainsItem(HexobjectKeys.axe);

  const dragItem = new DragInventoryItemFeature();
  await dragItem.dragToEquipSlot(HexobjectKeys.axe, EquipSlot.WEAPON);
  await verifyInventory.verifyItemEquipped(HexobjectKeys.axe, EquipSlot.WEAPON);

  const verifyTool = new VerifyToolActionFeature();
  await new UseEquippedToolFeature().use(HexobjectKeys.axe);
  await verifyTool.verifyToolHexVisible();

  await dragItem.dragEquippedToGridSlot(HexobjectKeys.axe, 'r0c1');
  await verifyTool.verifyToolHexHidden();
});
