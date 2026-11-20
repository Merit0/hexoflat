import { test } from '@fixtures';
import { EquipmentFocusFeature } from '@features/world/equipment-focus.feature';

test.describe('equipment Focus', { tag: ['@hero'] }, () => {
  test.describe.configure({ timeout: 120_000 });

  test('Hall: bag has no effect; equipped Focus adds Will, mistakes do not, capacity clamps', async () => {
    const focus = new EquipmentFocusFeature();
    await focus.start(4, false);
    await focus.openHall();
    await focus.answerHallWrong();
    await focus.verifyWill(10);
    await focus.answerHall(1, 2);
    await focus.equipFromHall();
    await focus.openHall();
    await focus.answerHall(5, 6);
    await focus.setWill(49);
    await focus.answerHall(1);
    await focus.reload();
    await focus.verifyWill(50);
  });

  test('Battle: correct answers restore +4 once, mistakes do not; removal and reload work', async () => {
    const focus = new EquipmentFocusFeature();
    await focus.start(4, true);
    await focus.startBattle();
    await focus.answerBattle(true);
    await focus.verifyWill(14);
    await focus.reload();
    await focus.verifyWill(14);
    await focus.answerBattle(false);
    await focus.verifyWill(14);
    await focus.remove();
    await focus.answerBattle(true);
    await focus.verifyWill(14);
  });

  test('Battle: owned Focus +5 restores only the missing Will at capacity', async () => {
    const focus = new EquipmentFocusFeature();
    await focus.start(5, true);
    await focus.startBattle();
    await focus.setWill(49);
    await focus.answerBattle(true);
    await focus.verifyWill(50);
    await focus.reload();
    await focus.verifyWill(50);
  });
});
