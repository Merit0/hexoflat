import { BaseFeature } from '@framework/base-feature';
import { API_URL } from '@config/env';

export class BurstLoginFeature extends BaseFeature {
  /**
   * Fires `count` failed logins straight at the API, bypassing the UI, so the
   * burst is fast and deterministic instead of depending on click/type timing.
   *
   * What this proves: the CI/local throttle budget is large enough for a full
   * parallel e2e run to hammer /auth/login without ever tripping 429 — see
   * apps/api's auth-throttle.env.ts (NON_PRODUCTION_AUTH_THROTTLE_LIMIT is
   * currently 2000/60s vs. 5/60s in production). That production actually
   * blocks at 5 is proven in apps/api/src/auth/auth.throttle.spec.ts, pinned
   * via AuthModule.forRoot(PRODUCTION_AUTH_THROTTLE_LIMIT) so it doesn't
   * depend on that test process's real NODE_ENV.
   */
  async burst(count: number): Promise<number[]> {
    return this.step(`Fire ${count} failed logins at POST /auth/login`, async () => {
      const statuses: number[] = [];

      for (let attempt = 0; attempt < count; attempt += 1) {
        const response = await this.request.post(`${API_URL}/auth/login`, {
          data: { username: 'rate-limit-probe', password: 'wrong' },
          failOnStatusCode: false,
        });
        statuses.push(response.status());
      }

      return statuses;
    });
  }
}
