import { test } from '@fixtures';
import { EquipmentWisdomFeature } from '@features/world/equipment-wisdom.feature';

test.describe('equipment Wisdom', { tag: ['@hero'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('Wisdom tokens display Wisdom and retain their reward after reload', async () => {
    const wisdom = new EquipmentWisdomFeature();
    await wisdom.start(4, false);
    await wisdom.verifyWisdomName();
    await wisdom.openHall();
    await wisdom.equipFromHall();
    await wisdom.reload();
    await wisdom.openHall();
    await wisdom.answerHall(5, 6);
  });

  test('Hall: bag has no effect; equipped Wisdom adds Will, mistakes do not, capacity clamps', async () => {
    const wisdom = new EquipmentWisdomFeature();
    await wisdom.start(4, false);
    await wisdom.openHall();
    await wisdom.answerHallWrong();
    await wisdom.verifyWill(10);
    await wisdom.answerHall(1, 2);
    await wisdom.equipFromHall();
    await wisdom.openHall();
    await wisdom.answerHall(5, 6);
    await wisdom.setWill(49);
    await wisdom.answerHall(1);
    await wisdom.reload();
    await wisdom.verifyWill(50);
  });

  test('Battle: correct answers restore +4 once, mistakes do not; removal and reload work', async () => {
    const wisdom = new EquipmentWisdomFeature();
    await wisdom.start(4, true);
    await wisdom.startBattle();
    await wisdom.answerBattle(true);
    await wisdom.verifyWill(14);
    await wisdom.reload();
    await wisdom.verifyWill(14);
    await wisdom.answerBattle(false);
    await wisdom.verifyWill(14);
    await wisdom.remove();
    await wisdom.answerBattle(true);
    await wisdom.verifyWill(14);
  });

  test('Battle: owned Wisdom +5 restores only the missing Will at capacity', async () => {
    const wisdom = new EquipmentWisdomFeature();
    await wisdom.start(5, true);
    await wisdom.startBattle();
    await wisdom.setWill(49);
    await wisdom.answerBattle(true);
    await wisdom.verifyWill(50);
    await wisdom.reload();
    await wisdom.verifyWill(50);
  });
});
