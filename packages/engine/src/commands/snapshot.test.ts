import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { HeroState } from '../hero-movement/hero-state';
import type { HexEngineState } from './apply-command';
import { deserializeState, serializeState } from './snapshot';

function buildState(): HexEngineState {
  const map = new HexMapBuilder().name('snapshot-test').width(2).height(2).build();
  const tile = map.tiles[0];
  tile.isRevealed = true;
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, tile.coordinates);

  const hero: HeroState = {
    id: 'hero-1',
    controlledBy: 'user-1',
    coordinates: { columnIndex: 0, rowIndex: 0 },
    heroSteps: 3,
  };

  return { map, heroes: { [hero.id]: hero } };
}

describe('snapshot: serializeState / deserializeState', () => {
  it('round-trips map and heroes', () => {
    const state = buildState();

    const payload = serializeState(state);
    const restored = deserializeState(payload);

    expect(restored.map.toJSON()).toEqual(state.map.toJSON());
    expect(restored.heroes).toEqual(state.heroes);
  });

  it('stamps a version on the payload', () => {
    const payload = serializeState(buildState());

    expect(payload.version).toBe(1);
  });
});
