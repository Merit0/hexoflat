import { assembleHexMapModel } from '../boards/hex-map-assembly';
import type { ResolvedCell } from '../boards/resolved-cell';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import { coordinateKey } from '../utils/hex-utils';
import { createKnowledgeState } from '../knowledge/state';
import type { HexEngineState } from '../commands/apply-command';
import { applyCommand } from '../commands/apply-command';
import { createContext } from '../commands/command-test-context';
import type { DomainEvent } from '../commands/types';
import type { SquadLifecyclePayload } from '../battle/battle-commands';

export const HERO = 'hero-1';

export interface FixtureOptions {
  squads: { key: THexobjectKey; at: IHexCoordinates }[];
  hero: IHexCoordinates;
  walls?: IHexCoordinates[];
  hidden?: IHexCoordinates[];
  will?: number;
}

export function squadWorld(options: FixtureOptions): HexEngineState {
  const squadAt = new Map(options.squads.map((s) => [coordinateKey(s.at), s.key]));
  const walls = new Set((options.walls ?? []).map(coordinateKey));
  const map = assembleHexMapModel({
    boardColumns: 9,
    boardRows: 9,
    background: '',
    cellAt: (coord): ResolvedCell => {
      const key = coordinateKey(coord);
      const squad = squadAt.get(key);
      if (walls.has(key))
        return { exists: true, hexobject: { hexobjectKey: HEXOBJECT_KEYS.STONE_WALL } };
      return { exists: true, ...(squad ? { hexobject: { hexobjectKey: squad } } : {}) };
    },
  });
  const hidden = new Set((options.hidden ?? []).map(coordinateKey));
  for (const tile of map.tiles) tile.isRevealed = !hidden.has(coordinateKey(tile.coordinates));
  const knowledge = createKnowledgeState(HERO);
  knowledge.current = options.will ?? 20;
  return {
    map,
    heroes: {
      [HERO]: {
        id: HERO,
        controlledBy: null,
        coordinates: { ...options.hero },
        heroSteps: 0,
        portal: null,
      },
    },
    knowledge,
    knowledgeContext: {
      locationKey: 'cave',
      mapId: 'cave',
      willZone: 'paid',
      combatActive: false,
      moving: false,
      atBook: false,
    },
  };
}

export function idAt(key: THexobjectKey, at: IHexCoordinates): string {
  return `${coordinateKey(at)}:${key}`;
}

export function hexAction(
  state: HexEngineState,
  actionType: EHexActionType,
  at: IHexCoordinates,
  now = 1000,
  toolKey: string = HEXOBJECT_KEYS.HAND,
): DomainEvent[] {
  return applyCommand(
    state,
    {
      type: 'START_HEX_ACTION',
      payload: { heroId: HERO, coordinates: at, actionType, toolKey, now },
    },
    createContext(),
  ).events;
}

type LifecycleInput = SquadLifecyclePayload extends infer P
  ? P extends SquadLifecyclePayload
    ? Omit<P, 'heroId' | 'atMs'>
    : never
  : never;

export function lifecycle(
  state: HexEngineState,
  payload: LifecycleInput,
  atMs = 1000,
): DomainEvent[] {
  return applyCommand(
    state,
    { type: 'BATTLE', payload: { heroId: HERO, atMs, ...payload } },
    createContext(),
  ).events;
}

export function moveHero(state: HexEngineState, target: IHexCoordinates): DomainEvent[] {
  return applyCommand(
    state,
    { type: 'MOVE_HERO', payload: { heroId: HERO, target } },
    createContext(),
  ).events;
}

export function eventTypes(events: DomainEvent[]): string[] {
  return events.map((e) => e.type);
}

export function rejection(events: DomainEvent[]): string | undefined {
  const squad = events.find((e) => e.type === 'SQUAD_REJECTED');
  if (squad) return (squad.payload as { reason?: string }).reason;
  const will = events.find((e) => e.type === 'WILL_REJECTED');
  return (will?.payload as { reason?: string } | undefined)?.reason;
}
