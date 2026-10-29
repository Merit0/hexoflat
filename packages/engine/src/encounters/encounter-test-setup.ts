import { assembleHexMapModel } from '../boards/hex-map-assembly';
import type { ResolvedCell } from '../boards/resolved-cell';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import { createKnowledgeState } from '../knowledge/state';
import type { HexEngineState } from '../commands/apply-command';
import { applyCommand } from '../commands/apply-command';
import { createContext } from '../commands/command-test-context';
import type { DomainEvent } from '../commands/types';
import type { EncounterAction } from './encounter-commands';
import { encounterInstanceId } from './map-encounter';

export const HERO = 'hero-1';

export interface FixtureOptions {
  encounters: { contentId: string; at: IHexCoordinates }[];
  hero: IHexCoordinates;
  walls?: IHexCoordinates[];
  hidden?: IHexCoordinates[];
  will?: number;
}

export function encounterWorld(options: FixtureOptions): HexEngineState {
  const encounterAt = new Map(options.encounters.map((e) => [coordinateKey(e.at), e.contentId]));
  const walls = new Set((options.walls ?? []).map(coordinateKey));
  const map = assembleHexMapModel({
    boardColumns: 9,
    boardRows: 9,
    background: '',
    cellAt: (coord): ResolvedCell => {
      const key = coordinateKey(coord);
      const contentId = encounterAt.get(key);
      return {
        exists: true,
        ...(walls.has(key) ? { hexobject: { hexobjectKey: HEXOBJECT_KEYS.STONE_WALL } } : {}),
        ...(contentId ? { encounter: { contentId } } : {}),
      };
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

export function idAt(contentId: string, at: IHexCoordinates): string {
  return encounterInstanceId(contentId, at);
}

export function encounterDo(
  state: HexEngineState,
  action: EncounterAction,
  atMs = 1000,
): DomainEvent[] {
  return applyCommand(
    state,
    { type: 'ENCOUNTER', payload: { heroId: HERO, atMs, action } },
    createContext(),
  ).events;
}

export function eventTypes(events: DomainEvent[]): string[] {
  return events.map((e) => e.type);
}

export function rejection(events: DomainEvent[]): string | undefined {
  const rejected = events.find((e) => e.type === 'ENCOUNTER_REJECTED');
  return (rejected?.payload as { reason?: string } | undefined)?.reason;
}
