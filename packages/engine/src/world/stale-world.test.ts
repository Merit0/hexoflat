import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '../content/content-version';
import {
  createServerWorld,
  deserializeWorld,
  serializeWorld,
  StaleWorldError,
  staleWorldOf,
} from './server-world';

const OBSOLETE_VERSION = 1;

function storedWorld(contentVersion: number): unknown {
  const raw = JSON.parse(
    JSON.stringify(serializeWorld(createServerWorld('silesia', 'map-s', 'seed-s', 'hero-1'))),
  ) as { contentVersion: number };
  raw.contentVersion = contentVersion;
  return raw;
}

describe('a world saved with another content version (LG5a, D5)', () => {
  it('is reported as stale with its location and map id', () => {
    const stale = staleWorldOf(storedWorld(OBSOLETE_VERSION));
    expect(stale).toBeInstanceOf(StaleWorldError);
    expect(stale).toMatchObject({
      locationKey: 'silesia',
      mapId: 'map-s',
      found: OBSOLETE_VERSION,
    });
  });

  it('is not stale with the current content version', () => {
    expect(staleWorldOf(storedWorld(CONTENT_VERSION))).toBeNull();
  });

  it('keeps version 1 and unknown versions obsolete (DA5a2-4)', () => {
    for (const version of [0, 1, 4, 999, '2', null, undefined])
      expect(
        staleWorldOf({ ...(storedWorld(3) as object), contentVersion: version }),
      ).toMatchObject({ found: version });
  });

  it('reads a version 2 world without a change except the version (DA5a-2)', () => {
    const old = storedWorld(2);
    const before = structuredClone(old);
    expect(staleWorldOf(old)).toBeNull();
    const saved: unknown = JSON.parse(JSON.stringify(serializeWorld(deserializeWorld(old, 0))));
    expect(saved).toEqual({ ...(before as object), contentVersion: 3 });
    expect(old).toEqual(before);
  });

  it('throws a StaleWorldError on load instead of a parse error', () => {
    expect(() => deserializeWorld(storedWorld(OBSOLETE_VERSION), 0)).toThrow(StaleWorldError);
  });
});
