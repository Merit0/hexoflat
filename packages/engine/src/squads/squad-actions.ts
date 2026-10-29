import type { DomainEvent } from '../commands/types';
import type HexMapModel from '../map/models/hex-map-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { HeroState } from '../hero-movement/hero-state';
import type { KnowledgeState } from '../knowledge/state';
import type { BattleState } from '../battle/battle-state';
import { approachDirection } from '../battle/battlefield-setup';
import type { Engagement, SquadRejection } from './engagement';
import { compositionKnown, findSquad, isAdjacent, type PlacedSquad } from './squad-state';

export interface SquadWorld {
  map: HexMapModel;
  heroes: Record<string, HeroState>;
  knowledge?: KnowledgeState;
  battle?: BattleState;
  engagement?: Engagement;
}

export interface SquadInput {
  heroId: string;
  atMs: number;
  squadId: string;
}

export type Outcome = { ok: true; events: DomainEvent[] } | { ok: false; reason: SquadRejection };

export const refuse = (reason: SquadRejection): Outcome => ({ ok: false, reason });
export const done = (events: DomainEvent[]): Outcome => ({ ok: true, events });

interface Target {
  hero: HeroState;
  placed: PlacedSquad;
}

function activeTarget(world: SquadWorld, input: SquadInput): Target | SquadRejection {
  if (world.battle || world.engagement) return 'BATTLE_OPEN';
  const hero = world.heroes[input.heroId];
  if (!hero) return 'NO_HERO';
  const placed = findSquad(world.map, input.squadId);
  if (!placed) return 'UNKNOWN_SQUAD';
  if (!isAdjacent(hero.coordinates, placed.tile.coordinates)) return 'NOT_ADJACENT';
  return { hero, placed };
}

function heroesAround(world: SquadWorld, at: IHexCoordinates): string[] {
  return Object.values(world.heroes)
    .filter((hero) => isAdjacent(hero.coordinates, at))
    .map((hero) => hero.id);
}

export function requestBattle(
  world: SquadWorld,
  placed: PlacedSquad,
  hero: HeroState,
  ambush: boolean,
): DomainEvent[] {
  const squadId = placed.squad.id;
  const heroIds = heroesAround(world, placed.tile.coordinates);
  world.engagement = {
    squadId,
    ambush,
    heroAt: { ...hero.coordinates },
    heroIds: heroIds.length ? heroIds : [hero.id],
    startItems: {},
  };
  const approach = approachDirection(placed.tile.coordinates, hero.coordinates);
  const requested: DomainEvent = {
    type: 'BATTLE_REQUESTED',
    payload: { squadId, ambush, approachDir: approach },
  };
  if (!ambush) return [requested];
  return [{ type: 'AMBUSH', payload: { squadId } }, requested];
}

export function attackSquad(world: SquadWorld, input: SquadInput): Outcome {
  const target = activeTarget(world, input);
  if (typeof target === 'string') return refuse(target);
  return done(requestBattle(world, target.placed, target.hero, false));
}

export function scoutSquad(world: SquadWorld, input: SquadInput): Outcome {
  const target = activeTarget(world, input);
  if (typeof target === 'string') return refuse(target);
  const { squad } = target.placed;
  if (compositionKnown(squad)) return refuse('ALREADY_SCOUTED');
  squad.creature.scouted = true;
  return done([
    {
      type: 'SQUAD_SCOUTED',
      payload: { squadId: squad.id, members: [...squad.creature.squad.members] },
    },
  ]);
}
