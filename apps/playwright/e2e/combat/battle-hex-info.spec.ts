import { test } from '@fixtures';
import { BattleHexInfoFeature } from '@features/world/battle-hex-info.feature';

test.describe('battle hover card', { tag: ['@combat'] }, () => {
  test('Hovering an enemy in a battle shows no card, the enemy list has its details', async () => {
    const hexInfo = new BattleHexInfoFeature();
    await hexInfo.startBattle();
    await hexInfo.hoverATerrain('saw');
    await hexInfo.verifyShowsTitle(/Saw/i);

    await hexInfo.hoverACreature('enemies');

    await hexInfo.verifyNoCard();
  });

  test('Hovering the hero in a battle shows no card, the hero board has the details', async () => {
    const hexInfo = new BattleHexInfoFeature();
    await hexInfo.startBattle();
    await hexInfo.hoverATerrain('saw');
    await hexInfo.verifyShowsTitle(/Saw/i);

    await hexInfo.hoverACreature('heroes');

    await hexInfo.verifyNoCard();
  });

  test('Hovering a saw in a battle shows a short warning and a hint', async () => {
    const hexInfo = new BattleHexInfoFeature();
    await hexInfo.startBattle();

    await hexInfo.hoverATerrain('saw');

    await hexInfo.verifyShowsTitle(/Saw/i);
    await hexInfo.verifyShowsAnIcon();
    await hexInfo.verifyShowsTheWarning();
  });
});
