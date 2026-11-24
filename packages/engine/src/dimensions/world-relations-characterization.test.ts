import { describe, expect, it } from 'vitest';
import { MapRegistry } from '../registry/world-map-registry';
import { CONTENT } from '../content/content-map';
import { locationDropContext } from '../registry/location-drop-context';
import { cloneWorldField } from '../quests/cloned-field';
import { questDropContext } from '../quests/quest-drop-context';
import { createServerWorld } from '../world/server-world';
import { EDimension } from './dimensions';

// Existing legal foreign placements and source selection must survive the relation wiring.
describe('D4 existing world relations', () => {
  it('the cave uses Earth terrain and a chest with its Underworld creatures and gate', () => {
    const { map } = MapRegistry.get('cave').create({ seed: 'd4-characterization' });
    const foreign = [
      ...new Set(
        map.tiles.flatMap((tile) =>
          tile.hexobject && CONTENT[tile.hexobject.hexobjectKey].dimension !== EDimension.UNDERWORLD
            ? [tile.hexobject.hexobjectKey]
            : [],
        ),
      ),
    ].sort();
    expect(foreign).toEqual(['chest', 'rock', 'stone-wall']);
  });

  it.each(['camping', 'silesia', 'silesia-north'] as const)(
    '%s retains Earth source scope',
    (key) => {
      expect(locationDropContext(key)).toEqual({ tokenType: 'idol', mapTier: 1 });
    },
  );

  it('a cloned cave quest captures its source tier rather than the camp claim location', () => {
    const world = createServerWorld('cave', 'd4-map', 'd4-seed', 'hero');
    world.descriptor = {
      kind: 'RECIPE',
      recipeId: 'cave',
      version: 1,
      seed: 'd4-seed',
      attempt: 0,
      params: { tier: 3 },
    };
    world.dropContext = locationDropContext('cave', world.descriptor);
    const field = cloneWorldField(world, world.heroCoordinates!);
    expect(field.origin).toBe('cave');
    expect(questDropContext({ field })).toEqual({ tokenType: 'gloom', mapTier: 3 });
  });
});
