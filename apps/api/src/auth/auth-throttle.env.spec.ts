import { afterEach, describe, expect, it } from 'vitest';
import {
  getAuthThrottleLimit,
  NON_PRODUCTION_AUTH_THROTTLE_LIMIT,
  PRODUCTION_AUTH_THROTTLE_LIMIT,
} from './auth-throttle.env';

describe('getAuthThrottleLimit', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns the production limit when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';

    expect(getAuthThrottleLimit()).toBe(PRODUCTION_AUTH_THROTTLE_LIMIT);
  });

  it('returns the non-production limit when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';

    expect(getAuthThrottleLimit()).toBe(NON_PRODUCTION_AUTH_THROTTLE_LIMIT);
  });

  it('returns the non-production limit when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;

    expect(getAuthThrottleLimit()).toBe(NON_PRODUCTION_AUTH_THROTTLE_LIMIT);
  });
});
