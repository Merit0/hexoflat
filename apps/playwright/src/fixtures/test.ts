import { test as base } from '@playwright/test';
import { setCurrentPage, setCurrentRequest } from '@framework/test-context';
import { registerTestUser, type RegisterResult, type TestUser } from '@api/register-user';
import { resetTestHero } from '@api/reset-hero';

interface WorkerFixtures {
  workerRegistration: RegisterResult;
  workerTestUser: TestUser;
}

interface TestFixtures {
  /** Auto-fixture: binds the ambient framework context for the test's lifetime. */
  bindTestContext: void;
  /** Auto-fixture: the worker's hero starts every test brand new on the server. */
  freshHero: void;
}

/**
 * The single entry point for every spec: `import { test, expect } from '@fixtures'`.
 * Importing '@playwright/test' directly inside e2e/** is an ESLint error, because
 * doing so skips `bindTestContext` and every Feature would then throw.
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  // One registration per worker — not per test, and not one shared global
  // one. This is what lets fullyParallel workers each drive their own hero
  // (movement, inventory) without racing over shared server state, and it
  // scales /auth/register load with worker count instead of test count.
  workerRegistration: [
    async ({}, use, workerInfo) => {
      await use(await registerTestUser(`w${workerInfo.parallelIndex}`));
    },
    { scope: 'worker' },
  ],

  workerTestUser: [
    async ({ workerRegistration }, use) => {
      await use(workerRegistration.user);
    },
    { scope: 'worker' },
  ],

  storageState: async ({ workerRegistration }, use) => {
    await use(workerRegistration.storageState);
  },

  freshHero: [
    async ({ workerRegistration }, use) => {
      await resetTestHero(workerRegistration);
      await use();
    },
    { auto: true },
  ],

  bindTestContext: [
    async ({ page, request }, use) => {
      setCurrentPage(page);
      setCurrentRequest(request);
      await use();
      setCurrentPage(undefined);
      setCurrentRequest(undefined);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
