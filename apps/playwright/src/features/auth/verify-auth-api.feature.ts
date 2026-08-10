import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';

/** Assertions about a batch of HTTP status codes collected by BurstLoginFeature/RecordSessionRequestsFeature. */
export class VerifyAuthApiFeature extends BaseFeature {
  verifyAllStatusesAre(statuses: number[], expectedStatus: number): void {
    expect(statuses.every((status) => status === expectedStatus)).toBe(true);
  }

  verifyStatusCountEquals(statuses: number[], expectedCount: number): void {
    expect(statuses.length).toBe(expectedCount);
  }
}
