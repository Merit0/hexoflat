import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BLOB_KEY_PATTERN, CLIENT_BLOB_KEYS } from './expedition-store';

describe('client blob keys', () => {
  it('allowed blob keys are fixed - reintroduce key-count and total-size limits if keys become dynamic', () => {
    expect([...CLIENT_BLOB_KEYS]).toEqual(['nav', 'progress', 'hero-store']);
    for (const key of CLIENT_BLOB_KEYS) expect(BLOB_KEY_PATTERN.test(key)).toBe(true);
    for (const key of [
      `map:${randomUUID()}`,
      `state:${randomUUID()}`,
      'index',
      'respawn',
      'nav:1',
      'progress-2',
      'hero-store/x',
      ' nav',
      'srv-index',
    ]) {
      expect(BLOB_KEY_PATTERN.test(key)).toBe(false);
    }
  });
});
