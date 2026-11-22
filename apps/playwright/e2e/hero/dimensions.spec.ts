import { test } from '@fixtures';
import { DimensionItemsFeature } from '@features/world/dimension-items.feature';

const GLOOM = /Dimension: Underworld|Вимір: Підземний світ/;
const SPARK = /Dimension: Heaven|Вимір: Небо/;
const ALIEN = /Dimension: Nowhere|Вимір: Ніде/;

test.describe('dimension ownership through the game', { tag: ['@hero'] }, () => {
  for (const [realm, label] of [
    ['gloom', GLOOM],
    ['spark', SPARK],
  ] as const) {
    test(`${realm} equipment keeps its full token through gates and reload`, async () => {
      const items = new DimensionItemsFeature();
      await items.startWithBase(realm);
      await items.equipAndVerify(label);
      await items.travelToUnderworldAndReload(label);
    });
  }

  test('ALIEN equipment remains Nowhere-owned after cross-dimension travel', async () => {
    const items = new DimensionItemsFeature();
    await items.startWithAlien();
    await items.equipAndVerify(ALIEN);
    await items.travelToUnderworldAndReload(ALIEN);
  });

  test('GLOOM trading and buyback preserve the complete stored token', async () => {
    const items = new DimensionItemsFeature();
    await items.startWithBase('gloom');
    await items.sellBuybackAndReload(GLOOM);
  });

  test('ALIEN trading and buyback preserve authored properties and skills', async () => {
    const items = new DimensionItemsFeature();
    await items.startWithAlien();
    await items.sellBuybackAndReload(ALIEN);
  });
});
