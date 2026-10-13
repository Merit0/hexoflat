import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { KnowledgeHallFeature } from '@features/world/knowledge-hall.feature';

test('Will depletion, emergency return, endless Hall questions and capped refill', async () => {
  test.setTimeout(240_000);
  await new OpenCampingMapFeature().open();
  const knowledge = new KnowledgeHallFeature();
  await knowledge.openHall();
  await knowledge.verifyStartingWill();
  await knowledge.exhaustWorldWill();
  await knowledge.completeReturn(17);
  await knowledge.openHall();
  await knowledge.earnWillInHall(6, 1, true);
  await knowledge.fillToCapacity();
});

test('Escape interrupts the Hall, reopening starts fresh and correct answers are accepted', async () => {
  test.setTimeout(120_000);
  await new OpenCampingMapFeature().open();
  const knowledge = new KnowledgeHallFeature();
  await knowledge.openHall();
  await knowledge.startHall();
  await knowledge.answerQuestions(3);
  await knowledge.interruptWithEscape();
  await knowledge.startHall();
  await knowledge.answerWithoutRejection();
  await knowledge.verifyMistakeShowsCorrectAnswerThenAdvances();
});

test('A hero cannot walk away while the Hall is open and is told why', async () => {
  await new OpenCampingMapFeature().open();
  const knowledge = new KnowledgeHallFeature();
  await knowledge.openHall();
  await knowledge.verifyHeroCannotMoveWhileOpen();
});

test('The question mark in the Hall explains what the Hall is for', async () => {
  await new OpenCampingMapFeature().open();
  const knowledge = new KnowledgeHallFeature();
  await knowledge.openHall();
  await knowledge.verifyHelpTooltip();
});
