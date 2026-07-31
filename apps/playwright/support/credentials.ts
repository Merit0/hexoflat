import { readFileSync } from 'node:fs';
import { TEST_USER_FILE } from './env';

export interface TestUser {
  username: string;
  password: string;
  name: string;
}

export function readTestUser(): TestUser {
  let raw: string;
  try {
    raw = readFileSync(TEST_USER_FILE, 'utf-8');
  } catch {
    throw new Error(
      'No test user found — global-setup.ts did not run or failed before writing ' +
        `${TEST_USER_FILE.pathname}. Run tests via "pnpm --filter @hexoflat/playwright test:e2e".`,
    );
  }

  return JSON.parse(raw) as TestUser;
}
