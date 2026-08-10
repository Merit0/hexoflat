import { API_URL, BROWSER_API_URL } from '@config/env';

export interface TestUser {
  username: string;
  password: string;
  name: string;
}

export interface RegisteredTestUserStorageState {
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
}

export interface RegisterResult {
  user: TestUser;
  storageState: RegisteredTestUserStorageState;
}

function uniqueUsername(label: string): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-${label}-${suffix}`;
}

// Turns the raw `Set-Cookie: session=<jwt>; Max-Age=604800; Path=/; HttpOnly;
// SameSite=Lax` header auth.controller.ts's setSessionCookie() sends into the
// shape @playwright/test's `storageState` expects. Hand-rolled rather than a
// generic cookie-parsing dependency since this only ever has to understand
// the one format our own server produces.
function buildStorageState(setCookieHeader: string): RegisteredTestUserStorageState {
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

// `label` gives each caller (one per worker — see support/fixtures.ts) a
// readable, non-colliding username instead of every registration racing over
// the same one. Registers a brand-new user against the real API and hands
// back an in-memory storage state — nothing is written to disk, so callers
// decide for themselves how to scope/reuse the result.
export async function registerTestUser(label: string): Promise<RegisterResult> {
  const user: TestUser = {
    username: uniqueUsername(label),
    password: 'E2ePassw0rd!',
    name: 'e2e-user',
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

  return { user, storageState: buildStorageState(setCookieHeader) };
}
