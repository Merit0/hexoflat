import { test as base } from '@playwright/test';
import { registerTestUser, type RegisterResult, type TestUser } from './register-user';

interface WorkerFixtures {
  workerRegistration: RegisterResult;
  workerTestUser: TestUser;
}

// One registration per worker, not per test and not one shared global one —
// see support/register-user.ts. This is what lets fullyParallel workers each
// drive their own hero (movement/inventory) without racing each other over
// shared state, and scales /auth/register load with worker count instead of
// test count.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- playwright's own fixture-extension pattern requires an empty object type here
export const test = base.extend<{}, WorkerFixtures>({
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
});

export { expect } from '@playwright/test';
