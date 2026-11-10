import { afterEach, describe, expect, it, vi } from 'vitest';

async function routeNames(): Promise<string[]> {
  vi.resetModules();
  const { default: router } = await import('./index');
  return router.getRoutes().map((route) => String(route.name));
}

describe('the dev battlefield route', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('exists in a dev build (REQ-B4-DEV-001)', async () => {
    vi.stubEnv('DEV', true);
    expect(await routeNames()).toContain('dev-battlefield');
  });

  it('is absent from a production build (REQ-B4-DEV-002)', async () => {
    vi.stubEnv('DEV', false);
    expect(await routeNames()).not.toContain('dev-battlefield');
  });
});
