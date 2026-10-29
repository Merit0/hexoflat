import type { DomainEvent } from '../commands/types';
import type HexMapModel from '../map/models/hex-map-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { HeroState } from '../hero-movement/hero-state';
import type { KnowledgeState } from '../knowledge/state';
import type { KnowledgeContext } from '../knowledge/commands';
import { willZoneCharges } from '../knowledge/will-zone';
import { spendWill } from '../knowledge/will';
import { generateHallQuestion } from '../knowledge/math';
import { taskOptions } from '../battle/timed-task';
import type { BattleState } from '../battle/battle-state';
import { coordinateKey, hexDistance } from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';
import { ENCOUNTER_RULES, encounterDef, type EncounterRules } from './encounter-content';
import {
  findEncounter,
  hexBehind,
  isAdjacent,
  isFreeFloor,
  watchingSentry,
  type PlacedEncounter,
} from './encounter-state';
import { approachDirection } from './battlefield-setup';
import type { Engagement, EncounterRejection } from './encounter-commands';

export interface EncounterWorld {
  map: HexMapModel;
  heroes: Record<string, HeroState>;
  knowledge?: KnowledgeState;
  knowledgeContext?: KnowledgeContext;
  battle?: BattleState;
  engagement?: Engagement;
}

export interface ActionInput {
  heroId: string;
  atMs: number;
  encounterId: string;
}

export type Outcome =
  { ok: true; events: DomainEvent[] } | { ok: false; reason: EncounterRejection };

export const refuse = (reason: EncounterRejection): Outcome => ({ ok: false, reason });
const done = (events: DomainEvent[]): Outcome => ({ ok: true, events });

interface Target {
  hero: HeroState;
  placed: PlacedEncounter;
}

function locate(world: EncounterWorld, input: ActionInput): Target | EncounterRejection {
  const hero = world.heroes[input.heroId];
  if (!hero) return 'NO_HERO';
  const placed = findEncounter(world.map, input.encounterId);
  if (!placed) return 'UNKNOWN_ENCOUNTER';
  if (!isAdjacent(hero.coordinates, placed.tile.coordinates)) return 'NOT_ADJACENT';
  return { hero, placed };
}

function activeTarget(world: EncounterWorld, input: ActionInput): Target | EncounterRejection {
  if (world.battle || world.engagement) return 'BATTLE_OPEN';
  const target = locate(world, input);
  if (typeof target === 'string') return target;
  if (target.placed.encounter.status !== 'active') return 'ENCOUNTER_DEFEATED';
  return target;
}

function charge(
  world: EncounterWorld,
  heroId: string,
  cost: number,
  ref: string,
): DomainEvent[] | EncounterRejection {
  if (cost <= 0 || !world.knowledgeContext || !willZoneCharges(world.knowledgeContext)) return [];
  const knowledge = world.knowledge;
  if (!knowledge || knowledge.heroId !== heroId) return 'NO_WILL_STATE';
  const spent = spendWill(knowledge, cost, 'action', ref);
  if (!spent.ok) return 'INSUFFICIENT_WILL';
  knowledge.revision++;
  return spent.events;
}

function heroesAround(world: EncounterWorld, at: IHexCoordinates): string[] {
  return Object.values(world.heroes)
    .filter((hero) => isAdjacent(hero.coordinates, at))
    .map((hero) => hero.id);
}

export function requestBattle(
  world: EncounterWorld,
  placed: PlacedEncounter,
  hero: HeroState,
  ambush: boolean,
): DomainEvent[] {
  const heroIds = heroesAround(world, placed.tile.coordinates);
  world.engagement = {
    encounterId: placed.encounter.id,
    ambush,
    heroAt: { ...hero.coordinates },
    heroIds: heroIds.length ? heroIds : [hero.id],
    startItems: {},
  };
  const approach = approachDirection(placed.tile.coordinates, hero.coordinates);
  const requested: DomainEvent = {
    type: 'BATTLE_REQUESTED',
    payload: { encounterId: placed.encounter.id, ambush, approachDir: approach },
  };
  if (!ambush) return [requested];
  return [{ type: 'AMBUSH', payload: { encounterId: placed.encounter.id } }, requested];
}

export function attackEncounter(
  world: EncounterWorld,
  input: ActionInput,
  rules: EncounterRules = ENCOUNTER_RULES,
): Outcome {
  const target = activeTarget(world, input);
  if (typeof target === 'string') return refuse(target);
  const spent = charge(world, input.heroId, rules.attackWill, `ATTACK:${input.encounterId}`);
  if (typeof spent === 'string') return refuse(spent);
  return done([...spent, ...requestBattle(world, target.placed, target.hero, false)]);
}

export function scoutEncounter(
  world: EncounterWorld,
  input: ActionInput,
  rules: EncounterRules = ENCOUNTER_RULES,
): Outcome {
  const target = activeTarget(world, input);
  if (typeof target === 'string') return refuse(target);
  const { encounter } = target.placed;
  if (encounter.scouted) return refuse('ALREADY_SCOUTED');
  const spent = charge(world, input.heroId, rules.scoutWill, `SCOUT:${input.encounterId}`);
  if (typeof spent === 'string') return refuse(spent);
  encounter.scouted = true;
  const members = encounterDef(encounter.contentId).members;
  return done([
    ...spent,
    { type: 'ENCOUNTER_SCOUTED', payload: { encounterId: encounter.id, members: [...members] } },
  ]);
}

export function startSneak(
  world: EncounterWorld,
  input: ActionInput,
  rules: EncounterRules = ENCOUNTER_RULES,
): Outcome {
  const target = activeTarget(world, input);
  if (typeof target === 'string') return refuse(target);
  const { encounter } = target.placed;
  if (encounter.sneak) return refuse('SNEAK_OPEN');
  encounter.taskSeq += 1;
  const seed = `${encounter.id}:sneak`;
  const question = generateHallQuestion(
    seed,
    encounter.taskSeq,
    world.knowledge?.history ?? {},
    [],
  );
  const options = taskOptions(question.answer, deriveStream(seed, `options:${encounter.taskSeq}`));
  encounter.sneak = {
    id: `${seed}:${encounter.taskSeq}`,
    heroId: input.heroId,
    question: { operation: question.operation, lhs: question.lhs, rhs: question.rhs },
    options,
    answer: question.answer,
    issuedAtMs: input.atMs,
    deadlineMs: input.atMs + rules.sneakMs,
    from: { ...target.hero.coordinates },
  };
  return done([
    {
      type: 'SNEAK_STARTED',
      payload: {
        encounterId: encounter.id,
        heroId: input.heroId,
        taskId: encounter.sneak.id,
        question: encounter.sneak.question,
        options,
        deadlineMs: encounter.sneak.deadlineMs,
      },
    },
  ]);
}

function heroStandsOn(world: EncounterWorld, at: IHexCoordinates): boolean {
  const key = coordinateKey(at);
  return Object.values(world.heroes).some((hero) => coordinateKey(hero.coordinates) === key);
}

export function resolveSneak(
  world: EncounterWorld,
  input: ActionInput,
  option: number | null,
): Outcome {
  const hero = world.heroes[input.heroId];
  if (!hero) return refuse('NO_HERO');
  const placed = findEncounter(world.map, input.encounterId);
  if (!placed) return refuse('UNKNOWN_ENCOUNTER');
  const task = placed.encounter.sneak;
  if (!task || task.heroId !== input.heroId) return refuse('NO_SNEAK');
  placed.encounter.sneak = undefined;
  const late = input.atMs > task.deadlineMs;
  const correct = !late && option !== null && task.options[option] === task.answer;
  if (!correct) return done(requestBattle(world, placed, hero, true));
  const behind = hexBehind(hero.coordinates, placed.tile.coordinates);
  const free =
    hexDistance(hero.coordinates, placed.tile.coordinates) === 1 &&
    isFreeFloor(world.map, behind) &&
    !heroStandsOn(world, behind);
  if (free) hero.coordinates = { ...behind };
  return done([
    {
      type: 'SNEAK_SUCCEEDED',
      payload: { encounterId: placed.encounter.id, heroId: hero.id, to: free ? behind : null },
    },
  ]);
}

export function pickupLoot(world: EncounterWorld, input: ActionInput): Outcome {
  const target = locate(world, input);
  if (typeof target === 'string') return refuse(target);
  const { encounter } = target.placed;
  if (encounter.status !== 'loot') return refuse('NO_LOOT');
  encounter.status = 'looted';
  const items = [...encounterDef(encounter.contentId).loot];
  return done([
    { type: 'LOOT_PICKED', payload: { encounterId: encounter.id, heroId: input.heroId, items } },
  ]);
}

export function stepEnded(world: EncounterWorld, heroId: string): Outcome {
  const hero = world.heroes[heroId];
  if (!hero) return refuse('NO_HERO');
  if (world.battle || world.engagement) return done([]);
  const sentry = watchingSentry(world.map, hero.coordinates);
  return done(sentry ? requestBattle(world, sentry, hero, true) : []);
}
