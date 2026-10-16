import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { TakeTokenFeature } from '@features/world/take-token.feature';
import { DragInventoryItemFeature } from '@features/world/drag-inventory-item.feature';
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
