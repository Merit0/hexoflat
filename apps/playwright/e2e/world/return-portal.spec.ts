import { test } from '@fixtures';
import { VerifyReturnPortalFeature } from '@features/world/verify-return-portal.feature';

test('A Return Scroll opens a portal to the camp and the same pair leads back', async () => {
  test.setTimeout(180_000);
  await new VerifyReturnPortalFeature().verifyRoundTripThroughThePortals();
});

test('Leaving the camp by its own gate removes both portals', async () => {
  test.setTimeout(180_000);
  await new VerifyReturnPortalFeature().verifyLeavingByTheGateClosesThePair();
});

test('A scroll without the Teleport skill refuses: only Angels can fly', async () => {
  test.setTimeout(180_000);
  await new VerifyReturnPortalFeature().verifyScrollRefusedWithoutTeleportSkill();
});

test('Teleport rank 1 lets a scroll open a portal for 10 Will', async () => {
  test.setTimeout(180_000);
  await new VerifyReturnPortalFeature().verifyTeleportRankOneOpensThePortalForTenWill();
});

test('A portal opened in the cave is one-way and the camp gets no portal', async () => {
  test.setTimeout(180_000);
  await new VerifyReturnPortalFeature().verifyCavePortalLeadsOneWay();
});
