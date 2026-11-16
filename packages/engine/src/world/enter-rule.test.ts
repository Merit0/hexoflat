import { describe, expect, it } from 'vitest';
import { enterRefusal, HERO_ELSEWHERE } from './enter-rule';

const at = (locationKey: string) => ({
  locationKey,
  mapId: 'map-1',
  coordinates: { columnIndex: 1, rowIndex: 1 },
});

describe('entering a location', () => {
  it('lets a hero with no place yet enter any location', () => {
    expect(enterRefusal(null, 'cave')).toBeNull();
    expect(enterRefusal(undefined, 'camping')).toBeNull();
  });

  it('lets a hero announce the location he already stands in', () => {
    expect(enterRefusal(at('silesia'), 'silesia')).toBeNull();
  });

  it('refuses a jump to another location, which only travel, a portal or a respawn may do', () => {
    expect(enterRefusal(at('camping'), 'cave')).toBe(HERO_ELSEWHERE);
    expect(enterRefusal(at('cave'), 'silesia')).toBe(HERO_ELSEWHERE);
  });
});
