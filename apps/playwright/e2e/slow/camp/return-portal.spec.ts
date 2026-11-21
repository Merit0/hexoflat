import { test } from '@fixtures';
import { VerifyReturnPortalFeature } from '@features/world/verify-return-portal.feature';

test.describe('return portal', { tag: ['@camp'] }, () => {
  test('Leaving the camp by its own gate removes both portals', async () => {
    await new VerifyReturnPortalFeature().verifyLeavingByTheGateClosesThePair();
  });
});
