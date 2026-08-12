import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { TakeTokenFeature } from '@features/world/take-token.feature';
import { OpenHeroInventoryFeature } from '@features/world/open-hero-inventory.feature';
import { CloseHeroInventoryFeature } from '@features/world/close-hero-inventory.feature';
import { DragInventoryItemFeature } from '@features/world/drag-inventory-item.feature';
import { VerifyInventoryFeature } from '@features/world/verify-inventory.feature';
import { HexobjectKeys } from '@config/test-data';
import { EquipSlot } from '@config/equip-slot';

test('Verify dragging a grid item to another grid slot moves it there', async () => {
  test.slow();
  await new OpenCampingMapFeature().open();
  await new TakeTokenFeature('starterAxe').take();
  await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.axe);
  await new OpenHeroInventoryFeature().open();

  await new DragInventoryItemFeature().dragToGridSlot(HexobjectKeys.axe, 'r0c0');

  await new VerifyInventoryFeature().verifyItemInGridSlot(HexobjectKeys.axe, 'r0c0');
  await new CloseHeroInventoryFeature().close();
});

test('Verify dragging an item onto an equip slot equips it, and dragging it back unequips it', async () => {
  test.slow();
  await new OpenCampingMapFeature().open();
  await new TakeTokenFeature('starterAxe').take();
  await new VerifyInventoryFeature().verifyContainsItem(HexobjectKeys.axe);
  await new OpenHeroInventoryFeature().open();
  const dragItem = new DragInventoryItemFeature();
  const verifyInventory = new VerifyInventoryFeature();

  await dragItem.dragToEquipSlot(HexobjectKeys.axe, EquipSlot.WEAPON);
  await verifyInventory.verifyItemEquipped(HexobjectKeys.axe, EquipSlot.WEAPON);

  await dragItem.dragEquippedToGridSlot(HexobjectKeys.axe, 'r0c1');
  await verifyInventory.verifyItemInGridSlot(HexobjectKeys.axe, 'r0c1');
  await new CloseHeroInventoryFeature().close();
});
