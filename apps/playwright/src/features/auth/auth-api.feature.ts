import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { API_URL } from '@config/env';

const SESSION_PATH = '/auth/session';

export class AuthApiFeature extends BaseFeature {
  private sessionStatuses: number[] = [];

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
  async burstLogin(count: number): Promise<number[]> {
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

  verifyEveryStatusIs(statuses: number[], expectedStatus: number): void {
    expect(statuses.every((status) => status === expectedStatus)).toBe(true);
  }

  /** Starts recording every `GET /auth/session` the page makes from now on. */
  async startRecordingSessionRequests(): Promise<void> {
    await this.step('Start recording GET /auth/session responses', async () => {
      this.sessionStatuses = [];
      this.page.on('response', (response) => {
        if (new URL(response.url()).pathname === SESSION_PATH) {
          this.sessionStatuses.push(response.status());
        }
      });
    });
  }

  async verifySessionRequestsAllSucceeded(expectedCount: number): Promise<void> {
    await this.step(
      `Verify all ${expectedCount} silent session restores returned 200`,
      async () => {
        expect(this.sessionStatuses.length).toBe(expectedCount);
        expect(this.sessionStatuses.every((status) => status === 200)).toBe(true);
      },
    );
  }
}
