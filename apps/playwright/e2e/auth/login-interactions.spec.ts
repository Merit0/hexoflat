import { test } from '@fixtures';
import { VerifyAuthInteractionsFeature } from '@features/auth/verify-auth-interactions.feature';

test.describe('login interactions', { tag: ['@auth'] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Verify the mode tabs switch between the three forms', async () => {
    await new VerifyAuthInteractionsFeature().verifyTabsSwitchModes();
  });

  test('Verify the eye toggle reveals the password and keeps focus in the input', async () => {
    await new VerifyAuthInteractionsFeature().verifyEyeToggleKeepsFocus();
  });

  test('Verify the Caps Lock warning shows under the password field', async () => {
    await new VerifyAuthInteractionsFeature().verifyCapsLockWarning();
  });

  test('Verify a signed-in hero is remembered on this device and fills the name', async ({
    workerTestUser,
  }) => {
    await new VerifyAuthInteractionsFeature().verifyRecentHeroAfterSignIn(workerTestUser);
  });

  test('Verify the rune pad numbers picks, resets and refuses an unbacked code', async ({
    workerTestUser,
  }) => {
    await new VerifyAuthInteractionsFeature().verifyRunePad(workerTestUser);
  });

  test('Verify the passkey button says it is not available yet', async () => {
    await new VerifyAuthInteractionsFeature().verifyPasskeyIsHonestlyUnavailable();
  });

  test('Verify the language button switches the page between EN and UA', async () => {
    await new VerifyAuthInteractionsFeature().verifyLanguageSwitch();
  });

  test('Verify a tagline dot jumps to its line', async () => {
    await new VerifyAuthInteractionsFeature().verifyTaglineDotJumps();
  });
});
