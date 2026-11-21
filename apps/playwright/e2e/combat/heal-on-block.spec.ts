import { test } from '@fixtures';
import { HealOnBlockFeature } from '@features/world/heal-on-block.feature';

test.describe('shield Heal on Block', { tag: ['@combat'] }, () => {
  test('Verify a shield in the bag does not heal a successful block', async () => {
    const healing = new HealOnBlockFeature();
    await healing.start(4, false);
    await healing.blockAndVerify(2);
    await healing.reloadAndVerify(2);
  });
  test('Verify a base shield heals half a heart once and keeps it after reload', async () => {
    const healing = new HealOnBlockFeature();
    await healing.start(1, true);
    await healing.blockAndVerify(3);
    await healing.reloadAndVerify(3);
  });
  test('Verify tier-four healing restores two hearts and clamps to full on the next block', async () => {
    const healing = new HealOnBlockFeature();
    await healing.start(4, true);
    await healing.blockAndVerify(6);
    await healing.reloadAndVerify(6);
    await healing.blockAndVerify(6);
  });
  test('Verify TAKE HIT does not trigger shield healing', async () => {
    const healing = new HealOnBlockFeature();
    await healing.start(4, true, 2);
    await healing.blockAndVerify(2, true);
    await healing.reloadAndVerify(2);
  });
});
