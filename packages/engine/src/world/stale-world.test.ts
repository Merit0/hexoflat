import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '../content/content-version';
import {
  createServerWorld,
  deserializeWorld,
  serializeWorld,
  StaleWorldError,
  staleWorldOf,
} from './server-world';

function storedWorld(contentVersion: number): unknown {
  const raw = JSON.parse(
    JSON.stringify(serializeWorld(createServerWorld('silesia', 'map-s', 'seed-s', 'hero-1'))),
  ) as { contentVersion: number };
  raw.contentVersion = contentVersion;
  return raw;
}

describe('a world saved with another content version (LG5a, D5)', () => {
  it('is reported as stale with its location and map id', () => {
    const stale = staleWorldOf(storedWorld(CONTENT_VERSION - 1));
    expect(stale).toBeInstanceOf(StaleWorldError);
    expect(stale).toMatchObject({
      locationKey: 'silesia',
      mapId: 'map-s',
      found: CONTENT_VERSION - 1,
    });
  });

  it('is not stale with the current content version', () => {
    expect(staleWorldOf(storedWorld(CONTENT_VERSION))).toBeNull();
  });

  it('throws a StaleWorldError on load instead of a parse error', () => {
    expect(() => deserializeWorld(storedWorld(CONTENT_VERSION - 1), 0)).toThrow(StaleWorldError);
  });
});
