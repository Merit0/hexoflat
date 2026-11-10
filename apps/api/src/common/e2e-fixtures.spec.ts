import { afterEach, describe, expect, it } from 'vitest';
import { assertE2eFixturesSafe, e2eFixturesEnabled } from './e2e-fixtures';

const saved = { flag: process.env.HEXOFLAT_E2E_FIXTURES, env: process.env.NODE_ENV };

function set(flag: string | undefined, env: string) {
  if (flag === undefined) delete process.env.HEXOFLAT_E2E_FIXTURES;
  else process.env.HEXOFLAT_E2E_FIXTURES = flag;
  process.env.NODE_ENV = env;
}

describe('the e2e fixtures flag', () => {
  afterEach(() => {
    set(saved.flag, saved.env ?? 'test');
  });

  it('is on only with the flag set to 1 outside production', () => {
    set('1', 'development');
    expect(e2eFixturesEnabled()).toBe(true);
    set(undefined, 'development');
    expect(e2eFixturesEnabled()).toBe(false);
    set('true', 'development');
    expect(e2eFixturesEnabled()).toBe(false);
    set('1', 'production');
    expect(e2eFixturesEnabled()).toBe(false);
  });

  it('refuses to start when the flag is on in production, and only then', () => {
    set('1', 'production');
    expect(() => assertE2eFixturesSafe()).toThrow(/production/);
    set('1', 'development');
    expect(() => assertE2eFixturesSafe()).not.toThrow();
    set(undefined, 'production');
    expect(() => assertE2eFixturesSafe()).not.toThrow();
  });
});
