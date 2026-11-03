import { test } from '@fixtures';
import { BattleFlowFeature } from '@features/world/battle-flow.feature';

test('Verify the initiative runs from token 1 up and the battle controls carry no stage bar', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.verifyInitiativeRunsFromTheLowestToken();
  await battle.verifyInitiativeChipsMatchTheCreatures();
  await battle.verifyOnlyApprovedHexesOnTheField();
  await battle.verifyNoStageBarOrBlockButton();
});

test('Verify an enemy that picks the hero waits where it stands while the hero holds the block window', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withShield: true });
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.verifyTheEnemyStandsStillWhileTheHeroBlocks();
  await battle.verifyNoEndTurnButtonInTheWindow();
});

test('Verify taking the hit lands it, wounds the hero and brings the enemy beside him', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withShield: true });
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.takeTheHit();
  await battle.verifyTheHitLandedAndTheEnemyWalkedUp();
  await battle.verifyTheHeroBoardFollowsTheDamageAtOnce();
});

test('Verify the battle writes its strikes to the Events tab', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withShield: true });
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.takeTheHit();
  await battle.verifyTheHitLandedAndTheEnemyWalkedUp();
  await battle.verifyTheBattleIsInTheEventsLog();
});

test('Verify the block window closes by itself after five seconds and the hit lands', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withShield: true });
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.verifyTheHitLandedAndTheEnemyWalkedUp();
});

test('Verify a shield raised through the tool hex is counted and the outcome matches the wounds', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withShield: true });
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.putAShieldThroughTheToolHex();
  await battle.verifyTheTrueShieldHexIsShownAfterTheHit();
  await battle.verifyTheWindowClosedByItselfAndTheHitIsConsistent();
});

test('Verify reloading in the middle of the block window does not freeze the battle', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withShield: true });
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.reloadInTheMiddleOfTheWindow();
  await battle.verifyTheBattleDoesNotFreezeAfterTheReload();
});

test('Verify the hero picks an enemy from where he stands and walks up only after the block', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.giveHeroTheTurn();
  await battle.aimTheHandAtAnEnemyAndStrike();
  await battle.chooseTheStrikeHexWhenAsked();
  await battle.verifyTheHeroWalkedUpAfterTheBlock();
});

test('Verify a bone court battle shows the skeleton king with his own sprite', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleAgainstTheBoneCourtAndVerifyTheKingSprite();
});

test('Verify a hurt hero shows the same hearts in the battle as on the hero board', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ hurtHero: true });
  await battle.verifyTheBattleHeartsMatchTheHeroBoard();
});

test('Verify USE on a return scroll during a battle tells the player it cannot be used', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withScroll: true });
  await battle.pressUseOnTheScrollDuringTheBattle();
  await battle.verifyTheBattleRefusesTheScroll();
});

test('Verify a melee swing hurts every enemy beside the hero, not only the one he picked', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ squad: 'bone-court' });
  await battle.giveHeroTheTurn();
  await battle.crowdTheHeroWithTwoEnemies();
  await battle.aimTheHandAtAnEnemyAndStrike();
  await battle.chooseTheStrikeHexWhenAsked();
  await battle.verifyTheOtherEnemyBesideTheHeroWasHurtToo();
});

test('Verify the swing reaches only the enemies beside the hero, not one two hexes away', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ squad: 'bone-court' });
  await battle.giveHeroTheTurn();
  await battle.crowdTheHeroWithOneBesideAndOneFar();
  await battle.aimTheHandAtAnEnemyAndStrike();
  await battle.chooseTheStrikeHexWhenAsked();
  await battle.verifyOnlyTheEnemiesBesideTheHeroWereSwept();
});

test('Verify the cost panel shows the attack price and the Will really spent equals it', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ squad: 'bone-court' });
  await battle.giveHeroTheTurn();
  await battle.crowdTheHeroWithTwoEnemies();
  await battle.hoverTheNearestEnemyWithTheWeapon();
  await battle.rememberTheDisplayedCost();
  await battle.pressTheToolAction();
  await battle.waitForTheAimToTimeOut();
  await battle.verifyTheWillSpentEqualsTheShownCost();
});

test('Verify the cost panel shows nothing for the weapon over an empty hex', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.giveHeroTheTurn();
  await battle.hoverAnEmptyHexWithTheWeapon();
  await battle.verifyTheCostIsZero();
});

test('Verify the cost turns red when the next action costs more than the Will left', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ squad: 'bone-court' });
  await battle.giveHeroTheTurn();
  await battle.crowdTheHeroWithTwoEnemies();
  await battle.giveHeroTheTurnWithWill(3);
  await battle.hoverTheNearestEnemyWithTheWeapon();
  await battle.verifyTheCostIsRed(7);
});

test('Verify a walk shows its path price, charges exactly that, and UNDO gives it back', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.giveHeroTheTurn();
  await battle.hoverAFreeHexToWalk();
  await battle.rememberTheDisplayedCost();
  await battle.tapTheHexToWalk();
  await battle.verifyTheHeroWalkedAndPaidTheShownCost();
  await battle.undoTheStep();
});

test('Verify END TURN passes the turn on to the next creature', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.giveHeroTheTurn();
  await battle.endTheTurn();
});

test('Verify shields are capped by the shield in hand and a tap on a raised one takes it down', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withShield: true });
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.holdTheWindowOpen();
  await battle.tapShieldHexes(3);
  await battle.verifyShieldsRaised(2, 2);
  await battle.tapTheFirstShieldAgain();
  await battle.verifyShieldsRaised(1, 2);
});

test('Verify the tool hex lifts the shield it just raised', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ withShield: true });
  await battle.giveEnemyTheTurn();
  await battle.waitForTheBlockWindow();
  await battle.putAShieldThroughTheToolHex();
  await battle.liftTheShieldWithTheToolHex();
  await battle.verifyShieldsRaised(0, 2);
});

test('Verify an aim that is not chosen runs out and the hero strikes from where he stands', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad({ squad: 'bone-court' });
  await battle.giveHeroTheTurn();
  await battle.crowdTheHeroWithTwoEnemies();
  await battle.hoverTheNearestEnemyWithTheWeapon();
  await battle.pressTheToolAction();
  await battle.waitForTheAimToTimeOut();
  await battle.verifyTheHeroStandsBesideTheTargetAfterTheAim();
});

test('Verify losing a battle closes it and brings the hero home alive', async () => {
  const battle = new BattleFlowFeature();

  await battle.startBattleNextToTheSquad();
  await battle.loseTheBattleAndLeave();
  await battle.verifyTheDefeatSentTheHeroHome();
});
