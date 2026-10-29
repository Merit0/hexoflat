import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { isTraversableTile } from '../hero-movement/movement-grid';
import {
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  hexDistance,
  offsetToAxial,
} from '../utils/hex-utils';
import { encounterDef } from './encounter-content';
import type { MapEncounter } from './map-encounter';
import { encounterThreat, type Threat, type ThreatProfile } from './threat';

export interface PlacedEncounter {
  tile: HexTileModel;
  encounter: MapEncounter;
}

export interface EncounterView {
  id: string;
  contentId: string;
  coordinates: IHexCoordinates;
  title: string;
  status: MapEncounter['status'];
  scouted: boolean;
  count: number;
  leaderKind: string;
  members: (string | null)[];
  threat: Threat;
  sentry: boolean;
  boss: boolean;
  loot: THexobjectKey[];
}

export function placedEncounters(map: HexMapModel): PlacedEncounter[] {
  return map.tiles
    .filter((tile) => !!tile.encounter)
    .map((tile) => ({ tile, encounter: tile.encounter as MapEncounter }));
}

export function findEncounter(map: HexMapModel, encounterId: string): PlacedEncounter | null {
  return placedEncounters(map).find((p) => p.encounter.id === encounterId) ?? null;
}

export function isAdjacent(a: IHexCoordinates, b: IHexCoordinates): boolean {
  return hexDistance(a, b) === 1;
}

export function compositionKnown(encounter: MapEncounter): boolean {
  return encounter.scouted || encounterDef(encounter.contentId).members.length === 1;
}

export function viewEncounter(placed: PlacedEncounter, hero: ThreatProfile): EncounterView {
  const { encounter, tile } = placed;
  const def = encounterDef(encounter.contentId);
  const known = compositionKnown(encounter);
  return {
    id: encounter.id,
    contentId: encounter.contentId,
    coordinates: { ...tile.coordinates },
    title: def.title,
    status: encounter.status,
    scouted: known,
    count: def.members.length,
    leaderKind: def.members[0],
    members: def.members.map((kind, i) => (known || i === 0 ? kind : null)),
    threat: encounterThreat(def.members, hero),
    sentry: def.sentry,
    boss: def.boss,
    loot: encounter.status === 'loot' ? [...def.loot] : [],
  };
}

export function projectEncounters(map: HexMapModel, hero: ThreatProfile): EncounterView[] {
  return placedEncounters(map)
    .filter((p) => p.tile.isRevealed && p.encounter.status !== 'looted')
    .map((p) => viewEncounter(p, hero));
}

function tileAt(map: HexMapModel, coord: IHexCoordinates): HexTileModel | undefined {
  const key = coordinateKey(coord);
  return map.tiles.find((t) => coordinateKey(t.coordinates) === key);
}

export function sentryWatchedHexes(map: HexMapModel): IHexCoordinates[] {
  return placedEncounters(map)
    .filter((p) => p.encounter.status === 'active' && encounterDef(p.encounter.contentId).sentry)
    .flatMap((p) => getHexNeighbors(p.tile.coordinates))
    .filter((coord) => isTraversableTile(tileAt(map, coord)));
}

export function watchingSentry(map: HexMapModel, at: IHexCoordinates): PlacedEncounter | null {
  return (
    placedEncounters(map).find(
      (p) =>
        p.encounter.status === 'active' &&
        encounterDef(p.encounter.contentId).sentry &&
        isAdjacent(p.tile.coordinates, at),
    ) ?? null
  );
}

export function hexBehind(hero: IHexCoordinates, encounter: IHexCoordinates): IHexCoordinates {
  const from = offsetToAxial(hero);
  const to = offsetToAxial(encounter);
  return axialToOffset({ q: 2 * to.q - from.q, r: 2 * to.r - from.r });
}

export function isFreeFloor(map: HexMapModel, coord: IHexCoordinates): boolean {
  return isTraversableTile(tileAt(map, coord));
}
