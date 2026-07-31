export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';

// 127.0.0.1, not 'localhost': apps/api binds explicitly to 0.0.0.0 (IPv4-only —
// see apps/api/src/main.ts's `app.listen(port, '0.0.0.0')`). Node's `fetch`
// (used by the health check/register calls below, unlike a browser) doesn't
// retry across address families, so if the OS resolver hands 'localhost'
// back as ::1 first, the health check fails with ECONNREFUSED even though
// the API is genuinely up and reachable on IPv4.
export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3000';

export const TEST_USER_FILE = new URL('../.tmp/test-user.json', import.meta.url);
