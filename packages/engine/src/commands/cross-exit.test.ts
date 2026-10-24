import { describe, expect, it, vi } from 'vitest';
import { MapRegistry } from '../registry/world-map-registry';
import { hexDistance } from '../utils/hex-utils';
import { applyCommand } from './apply-command';
import { buildHero, createContext, toState } from './command-test-context';
import type { HexEngineCommand } from './hex-engine-commands';

describe('applyCommand: CROSS_EXIT', () => {
  function silesiaWithHeroOn(side: 'N' | null) {
    const { map } = MapRegistry.get('silesia').create({ seed: '' });
    const exit = map.tiles.find((tile) => tile.exit === 'N')!;
    const elsewhere = map.tiles.find((tile) => !tile.exit && !tile.hexobject)!;
    const hero = buildHero({ coordinates: { ...(side ? exit : elsewhere).coordinates } });
    return { map, hero, exit };
  }

  const cross = (heroId: string): HexEngineCommand => ({
    type: 'CROSS_EXIT',
    payload: { heroId, from: 'silesia' },
  });

  it('crosses to the atlas neighbour and moves the hero off the exit beside it', () => {
    const { map, hero, exit } = silesiaWithHeroOn('N');

    const { events } = applyCommand(
      toState(map, { [hero.id]: hero }),
      cross(hero.id),
      createContext(),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'BOARD_EXITED',
      payload: {
        heroId: hero.id,
        from: 'silesia',
        to: 'silesia-north',
        exitSide: 'N',
        arrivalSide: 'S',
      },
    });
    expect(hexDistance(hero.coordinates, exit.coordinates)).toBe(1);
  });

  it.each([
    ['NOT_ON_EXIT', null, {}],
    ['IN_COMBAT', 'N', { combatActive: true }],
    ['SEALED', 'N', { isLocationRespawning: vi.fn(() => true) }],
  ] as const)('rejects with %s and leaves the hero where it stands', (reason, side, worldMap) => {
    const { map, hero } = silesiaWithHeroOn(side);
    const before = { ...hero.coordinates };
    const base = createContext();
    const ctx = createContext({ worldMap: { ...base.worldMap, ...worldMap } });

    const { events } = applyCommand(toState(map, { [hero.id]: hero }), cross(hero.id), ctx);

    expect(events).toEqual([{ type: 'BOARD_EXIT_REJECTED', payload: { heroId: hero.id, reason } }]);
    expect(hero.coordinates).toEqual(before);
  });

  it('rejects a board without an atlas neighbour on that side and an unknown hero', () => {
    const { map, hero } = silesiaWithHeroOn('N');
    const fromCave: HexEngineCommand = {
      type: 'CROSS_EXIT',
      payload: { heroId: hero.id, from: 'cave' },
    };

    expect(
      applyCommand(toState(map, { [hero.id]: hero }), fromCave, createContext()).events[0],
    ).toMatchObject({
      payload: { reason: 'NO_NEIGHBOUR' },
    });
    expect(applyCommand(toState(map), cross('ghost'), createContext()).events[0]).toMatchObject({
      payload: { reason: 'HERO_NOT_FOUND' },
    });
  });

  it('refuses a location key that is not registered', () => {
    const { map, hero } = silesiaWithHeroOn('N');
    const bogus = {
      type: 'CROSS_EXIT',
      payload: { heroId: hero.id, from: 'atlantis' },
    } as unknown as HexEngineCommand;

    expect(() => applyCommand(toState(map, { [hero.id]: hero }), bogus, createContext())).toThrow();
  });
});
