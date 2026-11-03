import { test } from '@fixtures';
import { VerifyAuthLayoutFeature } from '@features/auth/verify-auth-layout.feature';

test.describe('login layout', { tag: ['@auth'] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Verify the desktop layout is two columns with the brand panel', async () => {
    await new VerifyAuthLayoutFeature().verifyDesktopLayout();
  });

  test('Verify the tablet portrait layout keeps the card on screen', async () => {
    await new VerifyAuthLayoutFeature().verifyTabletLayout();
  });

  test('Verify the phone layout is a bottom sheet without the brand list', async () => {
    await new VerifyAuthLayoutFeature().verifyPhoneLayout();
  });

  test('Verify the Ukrainian card fits a 320px phone', async () => {
    await new VerifyAuthLayoutFeature().verifySmallestPhoneInUkrainian();
  });

  test('Verify the emblem animates when motion is allowed', async () => {
    await new VerifyAuthLayoutFeature().verifyMotionIsRunningByDefault();
  });

  test('Verify reduced motion stops the emblem animation', async () => {
    await new VerifyAuthLayoutFeature().verifyReducedMotionStopsAnimation();
  });
});
