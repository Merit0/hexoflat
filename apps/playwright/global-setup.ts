import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_URL, BROWSER_API_URL, STORAGE_STATE_FILE, TEST_USER_FILE } from './support/env';
import type { TestUser } from './support/credentials';

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

interface RegisterResult {
  user: TestUser;
  setCookieHeader: string;
}

async function registerTestUser(): Promise<RegisterResult> {
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

  const setCookieHeader = response.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error(
      `POST ${API_URL}/auth/register succeeded but returned no Set-Cookie header — ` +
        'did auth.controller.ts stop calling setSessionCookie()?',
    );
  }

  return { user, setCookieHeader };
}

// Turns the raw `Set-Cookie: session=<jwt>; Max-Age=604800; Path=/; HttpOnly;
// SameSite=Lax` header auth.controller.ts's setSessionCookie() sends into the
// shape @playwright/test's `storageState` expects. Hand-rolled rather than a
// generic cookie-parsing dependency since this only ever has to understand
// the one format our own server produces.
function buildStorageState(setCookieHeader: string): {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: [];
} {
  const [nameValuePart, ...attributeParts] = setCookieHeader.split(';').map((part) => part.trim());
  const separatorIndex = nameValuePart.indexOf('=');
  const name = nameValuePart.slice(0, separatorIndex);
  const value = nameValuePart.slice(separatorIndex + 1);

  let maxAgeSeconds = 0;
  let path = '/';
  let httpOnly = false;
  let secure = false;
  let sameSite: 'Strict' | 'Lax' | 'None' = 'Lax';

  for (const attribute of attributeParts) {
    const [rawKey, rawValue] = attribute.split('=');
    switch (rawKey.toLowerCase()) {
      case 'max-age':
        maxAgeSeconds = Number(rawValue);
        break;
      case 'path':
        path = rawValue;
        break;
      case 'httponly':
        httpOnly = true;
        break;
      case 'secure':
        secure = true;
        break;
      case 'samesite':
        sameSite = rawValue as 'Strict' | 'Lax' | 'None';
        break;
      default:
        break;
    }
  }

  // No Domain attribute on the real cookie (host-only) — the domain here has
  // to be the host the *browser* will actually call, i.e. BROWSER_API_URL,
  // not API_URL's 127.0.0.1 (see env.ts). A mismatch means the browser just
  // silently never sends the cookie back.
  const domain = new URL(BROWSER_API_URL).hostname;

  return {
    cookies: [
      {
        name,
        value,
        domain,
        path,
        expires: Math.floor(Date.now() / 1000) + maxAgeSeconds,
        httpOnly,
        secure,
        sameSite,
      },
    ],
    origins: [],
  };
}

export default async function globalSetup(): Promise<void> {
  await checkApiHealth();
  const { user, setCookieHeader } = await registerTestUser();

  const userFilePath = fileURLToPath(TEST_USER_FILE);
  mkdirSync(dirname(userFilePath), { recursive: true });
  writeFileSync(userFilePath, JSON.stringify(user, null, 2));

  const storageStatePath = fileURLToPath(STORAGE_STATE_FILE);
  mkdirSync(dirname(storageStatePath), { recursive: true });
  writeFileSync(storageStatePath, JSON.stringify(buildStorageState(setCookieHeader), null, 2));
}
