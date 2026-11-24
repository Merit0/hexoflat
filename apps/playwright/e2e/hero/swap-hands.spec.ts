import { test } from '@fixtures';
import { SwapHandsFeature } from '@features/world/swap-hands.feature';
import { UseEquippedToolFeature } from '@features/world/use-equipped-tool.feature';
import { VerifyToolActionFeature } from '@features/world/verify-tool-action.feature';
import { EquipmentBlockFeature } from '@features/world/equipment-block.feature';
import { EquipSlot } from '@config/equip-slot';
import { HexobjectKeys } from '@config/test-data';

const { sword, shield } = HexobjectKeys;
const hand = 'hand';

test.describe('hands', { tag: ['@hero'] }, () => {
  test('Verify the sword and the shield swap hands by dragging and stay swapped after a reload', async () => {
    const hands = new SwapHandsFeature();
    await hands.openCampHolding({ weapon: sword, shield });

    await hands.dragToHand(sword, EquipSlot.SHIELD);
    await hands.verifyHands(shield, sword);
    await hands.reloadInventory();
    await hands.verifyHands(shield, sword);

    await hands.dragToHand(sword, EquipSlot.WEAPON);
    await hands.verifyHands(sword, shield);
  });

  test('Verify the sword and the shield move into the empty other hand', async () => {
    const hands = new SwapHandsFeature();
    await hands.openCampHolding({ weapon: sword });
    await hands.dragToHand(sword, EquipSlot.SHIELD);
    await hands.verifyHands(hand, sword);
    await hands.dragToHand(sword, EquipSlot.WEAPON);
    await hands.verifyHands(sword, hand);
  });

  test('Verify the shield moves into the empty right hand and stays there after a reload', async () => {
    const hands = new SwapHandsFeature();
    await hands.openCampHolding({ shield });
    await hands.dragToHand(shield, EquipSlot.WEAPON);
    await hands.verifyHands(shield, hand);
    await hands.reloadInventory();
    await hands.verifyHands(shield, hand);
  });

  test('Verify USE shows exactly the chosen tool on the map when the other hand is empty', async () => {
    const hands = new SwapHandsFeature();
    const use = new UseEquippedToolFeature();
    const tool = new VerifyToolActionFeature();
    await hands.openCampHolding({ shield });

    for (const slot of [EquipSlot.SHIELD, EquipSlot.WEAPON]) {
      if (slot === EquipSlot.WEAPON) await hands.dragToHand(shield, slot);
      for (const key of [hand, shield, hand]) {
        await use.use(key);
        await tool.verifyToolShown(key);
      }
    }
  });

  test('Verify USE shows exactly the chosen tool on the map before and after the swap', async () => {
    const hands = new SwapHandsFeature();
    const use = new UseEquippedToolFeature();
    const tool = new VerifyToolActionFeature();
    await hands.openCampHolding({ weapon: sword, shield });

    for (const swapped of [false, true]) {
      if (swapped) {
        await hands.dragToHand(shield, EquipSlot.WEAPON);
        await hands.verifyHands(shield, sword);
      }
      for (const key of [shield, sword, shield]) {
        await use.use(key);
        await tool.verifyToolShown(key);
      }
    }
  });

  test('Verify swapped gear fights the same and swaps back during the battle', async () => {
    const hands = new SwapHandsFeature();
    await hands.openCampHolding({ weapon: sword, shield });
    await hands.dragToHand(sword, EquipSlot.SHIELD);
    await hands.verifyHands(shield, sword);

    await hands.attackWithTheSword();
    await hands.verifyBattleHands('wooden-shield', 'sword');
    await new EquipmentBlockFeature().raiseShields(1);

    await hands.swapInBattle(sword, EquipSlot.WEAPON);
    await hands.verifyBattleHands('sword', 'wooden-shield');
    await new EquipmentBlockFeature().raiseShields(1);
  });
});
