export const AUTH_THROTTLE_TTL_MS = 60_000;
export const PRODUCTION_AUTH_THROTTLE_LIMIT = 5;
export const NON_PRODUCTION_AUTH_THROTTLE_LIMIT = 2_000;

export function getAuthThrottleLimit(): number {
  return process.env.NODE_ENV === 'production'
    ? PRODUCTION_AUTH_THROTTLE_LIMIT
    : NON_PRODUCTION_AUTH_THROTTLE_LIMIT;
}
