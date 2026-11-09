import { API_URL } from '@config/env';
import type { RegisterResult } from '@api/register-user';

const tokens = new WeakMap<RegisterResult, string>();

async function login(registration: RegisterResult): Promise<string> {
  const { username, password } = registration.user;
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`POST /auth/login failed with HTTP ${response.status}`);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

async function reset(token: string): Promise<Response> {
  return fetch(`${API_URL}/player/dev/reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
}

/**
 * Puts the worker's hero back to a brand-new state on the server before a test. The hero now lives
 * in the database, so without this every test of a worker would inherit the previous one's bag.
 * The registration's session cookie is the access token; a logout in some test revokes it, and
 * only then is the (rate limited) login used.
 */
export async function resetTestHero(registration: RegisterResult): Promise<void> {
  const cached = tokens.get(registration) ?? registration.storageState.cookies[0].value;
  let response = await reset(cached);
  if (response.status === 401) {
    const fresh = await login(registration);
    tokens.set(registration, fresh);
    response = await reset(fresh);
  }
  if (!response.ok) {
    throw new Error(`POST /player/dev/reset failed with HTTP ${response.status}`);
  }
}
