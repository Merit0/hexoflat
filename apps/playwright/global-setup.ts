import { API_URL } from './support/env';

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

// Test users are now registered per-worker (see support/fixtures.ts /
// support/register-user.ts), not once globally here — this just confirms
// the API is up before any worker starts registering.
export default async function globalSetup(): Promise<void> {
  await checkApiHealth();
}
