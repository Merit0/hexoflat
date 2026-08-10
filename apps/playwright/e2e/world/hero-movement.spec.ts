import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { MoveHeroFeature } from '@features/world/move-hero.feature';

const STEPS_BEFORE_RELOAD = 3;

test('Verify clicking an adjacent tile moves the hero there', async () => {
  await new OpenCampingMapFeature().open();

  const moveHero = new MoveHeroFeature();
  const positionBefore = await moveHero.readPosition();
  const stepsBefore = await moveHero.readStepsChipText();

  await moveHero.moveOneStep();

  await moveHero.verifyPositionChanged(positionBefore);
  await moveHero.verifyStepsChipChanged(stepsBefore);
});

test('Verify Hero saves map placement after movement on reload page', async () => {
  await new OpenCampingMapFeature().open();

  const moveHero = new MoveHeroFeature();
  const positionBefore = await moveHero.readPosition();

  const positionAfter = await moveHero.moveSteps(STEPS_BEFORE_RELOAD);
  await moveHero.verifyPositionChanged(positionBefore);

  await moveHero.verifyPositionSurvivesReload(positionAfter);
});
