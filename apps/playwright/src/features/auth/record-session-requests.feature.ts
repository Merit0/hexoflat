import { BaseFeature } from '@framework/base-feature';

const SESSION_PATH = '/auth/session';

export class RecordSessionRequestsFeature extends BaseFeature {
  private statuses: number[] = [];

  /** Starts recording every `GET /auth/session` the page makes from now on. */
  async record(): Promise<void> {
    await this.step('Start recording GET /auth/session responses', async () => {
      this.statuses = [];
      this.page.on('response', (response) => {
        if (new URL(response.url()).pathname === SESSION_PATH) {
          this.statuses.push(response.status());
        }
      });
    });
  }

  /** Snapshot of every status code recorded since the last `record()` call. */
  readStatuses(): number[] {
    return this.statuses;
  }
}
