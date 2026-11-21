import { test } from '@fixtures';
import { EquipmentSmartStepFeature } from '@features/world/equipment-smart-step.feature';

test.describe('equipment Smart Step', { tag: ['@hero'] }, () => {
  test.describe.configure({ timeout: 120_000 });
  test('EA-11: every fifth world step is free; reload and camp retain the counter', async () => {
    const step = new EquipmentSmartStepFeature();
    await step.start();
    await step.equip();
    await step.walk(20);
    await step.verify(34, 20);
    await step.reload();
    await step.verify(34, 20);
    await step.visitCamp(34);
    await step.walk(2);
    await step.verify(34, 20);
  });

  test('bag has no effect; a free step works at zero Will; swaps and removal keep the phase', async () => {
    const step = new EquipmentSmartStepFeature();
    await step.start();
    await step.walk(4);
    await step.verify(46, 4);
    await step.equip();
    await step.setWill(0);
    await step.reload();
    await step.walk(1);
    await step.verify(0, 5);
    await step.verifyNextStepBlocked();
    await step.verify(0, 5);
    await step.replace(3);
    await step.walk(1);
    await step.verify(0, 6);
    await step.remove();
    await step.verifyNextStepBlocked();
    await step.verify(0, 6);
    await step.setWill(2);
    await step.walk(1);
    await step.verify(1, 7);
  });

  test('an owned N=1 token allows consecutive world steps at zero Will', async () => {
    const step = new EquipmentSmartStepFeature();
    await step.start(1, 0);
    await step.equip();
    await step.walk(3);
    await step.verify(0, 3);
    await step.reload();
    await step.walk(1);
    await step.verify(0, 4);
  });
});
