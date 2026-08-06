export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';

// 127.0.0.1, not 'localhost': apps/api binds explicitly to 0.0.0.0 (IPv4-only —
// see apps/api/src/main.ts's `app.listen(port, '0.0.0.0')`). Node's `fetch`
// (used by the health check/register calls below, unlike a browser) doesn't
// retry across address families, so if the OS resolver hands 'localhost'
// back as ::1 first, the health check fails with ECONNREFUSED even though
// the API is genuinely up and reachable on IPv4.
export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3000';

// Matches apps/web's VITE_API_URL default (see apps/web/src/api/client.ts) —
// the *browser* always calls the API at this host, so the storage-state
// cookie global-setup.ts mints must be scoped to this hostname, not
// API_URL's 127.0.0.1 (which exists only to dodge Node fetch's IPv6-first
// resolution, see the comment above — a concern that's specific to Node's
// fetch, not the browser).
export const BROWSER_API_URL = process.env.E2E_BROWSER_API_URL ?? 'http://localhost:3000';

export const TEST_USER_FILE = new URL('../.tmp/test-user.json', import.meta.url);

// Pre-authenticated browser storage state for the test user above — see
// global-setup.ts. Most specs load this by default (playwright.config.ts)
// instead of driving the login form, so they don't each burn a slot in
// /auth/login's throttle bucket; specs that test the auth flow itself opt
// out via `test.use({ storageState: { cookies: [], origins: [] } })`.
export const STORAGE_STATE_FILE = new URL('../.tmp/storage-state.json', import.meta.url);
