import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import { SquadActionsFeature } from '@features/world/squad-actions.feature';
import { HexobjectKeys } from '@config/test-data';

test('Verify the hand on a squad token offers ATTACK and the opened battle survives a reload', async () => {
  await new OpenCampingMapFeature().open();
  const squad = new SquadActionsFeature();

  await squad.placeSquadNextToHero(HexobjectKeys.skeletonPack);
  await squad.aimHandAtSquad();
  await squad.verifyHandOffersAttack();

  await squad.attack();
  await squad.verifyDeployCardOpen();

  await new ReloadCampingMapFeature().reload();
  await squad.verifyDeployCardOpen();
});

test('Verify leaving a won battle in the cave brings the board back without render errors', async () => {
  test.setTimeout(120_000);
  const squad = new SquadActionsFeature();

  await squad.openCave();
  await squad.placeSquadNextToHero(HexobjectKeys.skeletonPack);
  await squad.aimHandAtSquad();
  await squad.attack();
  await squad.startBattle();
  await squad.winAndLeaveBattle();
  await squad.verifyBoardIsBackWithoutErrors();
});
