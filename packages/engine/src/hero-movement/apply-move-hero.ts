import type { MoveHeroCommand } from '../commands/hex-engine-commands';
import type { DomainEvent } from '../commands/types';
import { coordinateKey } from '../utils/hex-utils';
import { ambushAt, ambushStop } from '../squads/apply-squad';
import type { SquadWorld } from '../squads/squad-actions';
import { getReachableTileDistances } from './reachable-range-service';
import { findShortestPath } from './pathfinding-service';
import { getScoutMoveStepsForSteps } from './scout-progression';

function rejected(
  payload: MoveHeroCommand['payload'],
  reason: 'HERO_NOT_FOUND' | 'TILE_OCCUPIED' | 'UNREACHABLE' | 'NO_PATH',
): DomainEvent {
  return { type: 'HERO_MOVE_REJECTED', payload: { ...payload, reason } };
}

export function applyMoveHero(
  state: SquadWorld,
  payload: MoveHeroCommand['payload'],
): DomainEvent[] {
  const { heroId, target } = payload;
  const hero = state.heroes[heroId];
  if (!hero) return [rejected(payload, 'HERO_NOT_FOUND')];

  const targetKey = coordinateKey(target);
  const isOccupiedByOtherHero = Object.values(state.heroes).some(
    (other) => other.id !== heroId && coordinateKey(other.coordinates) === targetKey,
  );
  if (isOccupiedByOtherHero) return [rejected(payload, 'TILE_OCCUPIED')];

  const moveSteps = getScoutMoveStepsForSteps(hero.heroSteps);
  const reachable = getReachableTileDistances(state.map, hero.coordinates, moveSteps);
  if (!reachable.has(targetKey)) return [rejected(payload, 'UNREACHABLE')];

  const fullPath = findShortestPath(state.map, hero.coordinates, target, moveSteps);
  if (!fullPath || fullPath.length < 2) return [rejected(payload, 'NO_PATH')];

  const stop = ambushStop(state, fullPath);
  const path = stop > 0 ? fullPath.slice(0, stop + 1) : fullPath;
  // Deliberate in-place mutation, not a copy-on-write update: applyCommand
  // has exactly one writer per HexEngineState (the single-threaded
  // server/client loop that owns `state`), so there's no concurrent
  // reader to see a torn intermediate value. Don't "fix" this into
  // rebuilding `state.heroes` — that would just be extra allocation for
  // the same guarantee this already has.
  hero.coordinates = { ...path[path.length - 1] };
  hero.heroSteps += path.length - 1;

  return [
    { type: 'HERO_MOVED', payload: { heroId, path, heroSteps: hero.heroSteps } },
    ...(stop > 0 ? ambushAt(state, heroId) : []),
  ];
}
