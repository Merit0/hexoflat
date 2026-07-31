import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_URL, TEST_USER_FILE } from './tests/support/env';
import type { TestUser } from './tests/support/credentials';

const HEALTH_TIMEOUT_MS = 5_000;

async function checkApiHealth(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `apps/api is not reachable at ${API_URL}/health (${(error as Error).message}).\n` +
        'Playwright e2e needs the backend + Postgres running first:\n' +
        '  docker compose -f docker-compose.dev.yml up -d\n' +
        '  pnpm --filter @hexoflat/api db:push\n' +
        '  pnpm --filter @hexoflat/api start:dev\n' +
        'Set E2E_API_URL if the API is not on http://localhost:3000.',
    );
  }

  if (!response.ok) {
    throw new Error(
      `apps/api health check at ${API_URL}/health returned HTTP ${response.status}. ` +
        'Is the API pointed at a reachable Postgres (see docker-compose.dev.yml)?',
    );
  }
}

function uniqueUsername(): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-${suffix}`;
}

async function registerTestUser(): Promise<TestUser> {
  const user: TestUser = {
    username: uniqueUsername(),
    password: 'E2ePassw0rd!',
    name: 'E2E Hero',
  };

  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`POST ${API_URL}/auth/register failed with HTTP ${response.status}: ${body}`);
  }

  return user;
}

export default async function globalSetup(): Promise<void> {
  await checkApiHealth();
  const user = await registerTestUser();

  const filePath = fileURLToPath(TEST_USER_FILE);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(user, null, 2));
}
