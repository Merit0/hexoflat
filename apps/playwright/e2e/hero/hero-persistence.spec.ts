import { test } from '@fixtures';
import { HeroPersistenceFeature } from '@features/world/hero-persistence.feature';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { VerifyHeroPositionFeature } from '@features/world/verify-hero-position.feature';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { HexobjectKeys as K } from '@config/test-data';

test.describe('the hero lives on the server', { tag: ['@hero'] }, () => {
  test('Verify a brand-new hero starts with an empty bag, no coins and no scrolls', async () => {
    await new OpenCampingMapFeature().open();

    await new HeroPersistenceFeature().verifyNewHeroHasNothing([
      K.coins,
      K.returnScroll,
      K.sword,
      K.shield,
    ]);
  });

  test('Verify what the hero received is still there after a reload', async () => {
    await new OpenCampingMapFeature().open();
    const hero = new HeroPersistenceFeature();
    await hero.receiveAndWaitUntilSaved(K.healthBottle, 3);

    await hero.reload();

    await hero.verifyHolds(K.healthBottle, 3);
  });

  test('Verify editing the browser storage by hand gives the hero nothing', async () => {
    await new OpenCampingMapFeature().open();
    const hero = new HeroPersistenceFeature();
    await hero.forgeLocalInventory(K.coins, 999);

    await hero.reload();

    await hero.verifyHolds(K.coins, 0);
  });

  test('Verify a second tab takes the hero over and the first tab is told it no longer saves', async () => {
    await new OpenCampingMapFeature().open();
    const hero = new HeroPersistenceFeature();

    await hero.takeTheHeroOverFromAnotherTab();

    await hero.verifyFirstTabIsToldItNoLongerSaves();
  });

  test('Verify the world follows the hero: with the browser storage wiped, he stands where he stopped', async () => {
    await new OpenCampingMapFeature().open();
    const hero = new HeroPersistenceFeature();
    const moveHero = new MoveHeroFeature();
    const positionAfter = await moveHero.moveSteps(3);

    await hero.wipeEverythingTheBrowserKeeps();
    await hero.reload();

    await new VerifyHeroPositionFeature().verifySurvivesReload(positionAfter);
  });
});
