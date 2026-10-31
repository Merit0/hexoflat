import { test } from '@fixtures';
import { BattleFlowFeature } from '@features/world/battle-flow.feature';

test('Verify the initiative runs from token 1 up and the battle controls carry no stage bar', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.verifyInitiativeRunsFromTheLowestToken();
  await battle.verifyNoStageBarOrBlockButton();
});

test('Verify an enemy that picks the hero waits where it stands while the hero holds the block window', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.verifyTheEnemyStandsStillWhileTheHeroBlocks();
});

test('Verify taking the hit lands it, wounds the hero and brings the enemy beside him', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.takeTheHit();
  await battle.verifyTheHitLandedAndTheEnemyWalkedUp();
  await battle.verifyTheHeroBoardFollowsTheDamageAtOnce();
});

test('Verify the battle writes its strikes to the Events tab', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.takeTheHit();
  await battle.verifyTheHitLandedAndTheEnemyWalkedUp();
  await battle.verifyTheBattleIsInTheEventsLog();
});

test('Verify the block window closes by itself after five seconds and the hit lands', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.verifyTheHitLandedAndTheEnemyWalkedUp();
});

test('Verify a shield raised through the tool hex is counted and the outcome matches the wounds', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withShield: true });
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.putAShieldThroughTheToolHex();
  await battle.verifyTheTrueShieldHexIsShownAfterTheHit();
  await battle.verifyTheWindowClosedByItselfAndTheHitIsConsistent();
});

test('Verify reloading in the middle of the block window does not freeze the battle', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.reloadInTheMiddleOfTheWindow();
  await battle.verifyTheBattleDoesNotFreezeAfterTheReload();
});

test('Verify the hero picks an enemy from where he stands and walks up only after the block', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.giveHeroTheTurn();
  await battle.aimTheHandAtAnEnemyAndStrike();
  await battle.chooseTheStrikeHexWhenAsked();
  await battle.verifyTheHeroWalkedUpAfterTheBlock();
});

test('Verify a bone court battle shows the skeleton king with his own sprite', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleAgainstTheBoneCourtAndVerifyTheKingSprite();
});

test('Verify a hurt hero shows the same hearts in the battle as on the hero board', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ hurtHero: true });
  await battle.verifyTheBattleHeartsMatchTheHeroBoard();
});

test('Verify USE on a return scroll during a battle tells the player it cannot be used', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withScroll: true });
  await battle.pressUseOnTheScrollDuringTheBattle();
  await battle.verifyTheBattleRefusesTheScroll();
});

test('Verify a melee swing hurts every enemy beside the hero, not only the one he picked', async () => {
  test.setTimeout(120_000);
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ squad: 'bone-court' });
  await battle.giveHeroTheTurn();
  await battle.crowdTheHeroWithTwoEnemies();
  await battle.aimTheHandAtAnEnemyAndStrike();
  await battle.chooseTheStrikeHexWhenAsked();
  await battle.verifyTheOtherEnemyBesideTheHeroWasHurtToo();
});
