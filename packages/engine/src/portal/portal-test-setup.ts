import { vi } from 'vitest';
import { type HexEngineState } from '../commands/apply-command';
import { buildHero, createContext } from '../commands/command-test-context';
import { createKnowledgeState } from '../knowledge/state';
import { grantWill } from '../knowledge/will';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { MapRegistry, type LocationKey } from '../registry/world-map-registry';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';

export function setup(
  options: {
    location?: LocationKey;
    boardKind?: 'STATIC' | 'DUNGEON';
    will?: number;
    scrolls?: number;
    combat?: boolean;
  } = {},
) {
  const locationKey = options.location ?? 'silesia';
  const { map } = MapRegistry.get(locationKey).create({ seed: '' });
  const free = map.tiles.filter((t) => t.terrain === 'ground' && !t.hexobject && !t.exit);
  const isFree = (c: IHexCoordinates) => {
    const n = map.tiles.find((x) => coordinateKey(x.coordinates) === coordinateKey(c));
    return !!n && n.terrain === 'ground' && !n.hexobject && !n.exit;
  };
  const heroTile = free.find((t) => getHexNeighbors(t.coordinates).some(isFree))!;
  const hero = buildHero({ coordinates: { ...heroTile.coordinates } });
  const knowledge = createKnowledgeState(hero.id);
  knowledge.current = 0;
  grantWill(knowledge, options.will ?? 20, { kind: 'dev', ref: 'test' });
  const state: HexEngineState = {
    map,
    heroes: { [hero.id]: hero },
    knowledge,
    location: { locationKey, mapId: 'map-1', boardKind: options.boardKind ?? 'STATIC' },
  };
  let scrolls = options.scrolls ?? 1;
  const base = createContext();
  const ctx = createContext({
    inventory: {
      ...base.inventory,
      countItem: vi.fn(() => scrolls),
      takeFromInventory: vi.fn(() => {
        scrolls--;
        return { ok: true };
      }),
    },
    worldMap: { ...base.worldMap, combatActive: options.combat ?? false },
  });
  const target = getHexNeighbors(hero.coordinates).find(isFree)!;
  return { state, hero, ctx, target, scrolls: () => scrolls };
}

export const open = (heroId: string, target: IHexCoordinates) =>
  ({ type: 'OPEN_PORTAL', payload: { heroId, target } }) as const;
export const enter = (heroId: string) => ({ type: 'ENTER_PORTAL', payload: { heroId } }) as const;

export function tileAt(state: HexEngineState, c: IHexCoordinates) {
  return state.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(c))!;
}
