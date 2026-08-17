import { getReachableTileDistances } from '../../hero-movement/reachable-range-service';
import { findShortestPath } from '../../hero-movement/pathfinding-service';
import { getScoutMoveStepsForSteps } from '../../hero-movement/scout-progression';
import { coordinateKey } from '../../utils/hex-utils';
import type { MoveHeroCommand } from '../hex-engine-commands';
import type { CommandHandler } from './handler-types';

export const moveHeroHandler: CommandHandler<MoveHeroCommand> = (state, command) => {
  const { heroId, target } = command.payload;
  const hero = state.heroes[heroId];

  if (!hero) {
    return [{ type: 'HERO_MOVE_REJECTED', payload: { heroId, target, reason: 'HERO_NOT_FOUND' } }];
  }

  const targetKey = coordinateKey(target);
  const isOccupiedByOtherHero = Object.values(state.heroes).some(
    (other) => other.id !== heroId && coordinateKey(other.coordinates) === targetKey,
  );

  if (isOccupiedByOtherHero) {
    return [{ type: 'HERO_MOVE_REJECTED', payload: { heroId, target, reason: 'TILE_OCCUPIED' } }];
  }

  const moveSteps = getScoutMoveStepsForSteps(hero.heroSteps);
  const reachable = getReachableTileDistances(state.map, hero.coordinates, moveSteps);

  if (!reachable.has(targetKey)) {
    return [{ type: 'HERO_MOVE_REJECTED', payload: { heroId, target, reason: 'UNREACHABLE' } }];
  }

  const path = findShortestPath(state.map, hero.coordinates, target, moveSteps);

  if (!path || path.length < 2) {
    return [{ type: 'HERO_MOVE_REJECTED', payload: { heroId, target, reason: 'NO_PATH' } }];
  }

  const stepsTaken = path.length - 1;
  // Deliberate in-place mutation, not a copy-on-write update: applyCommand
  // has exactly one writer per HexEngineState (the single-threaded
  // server/client loop that owns `state`), so there's no concurrent
  // reader to see a torn intermediate value. Don't "fix" this into
  // rebuilding `state.heroes` — that would just be extra allocation for
  // the same guarantee this already has.
  hero.coordinates = { ...target };
  hero.heroSteps += stepsTaken;

  return [{ type: 'HERO_MOVED', payload: { heroId, path, heroSteps: hero.heroSteps } }];
};
