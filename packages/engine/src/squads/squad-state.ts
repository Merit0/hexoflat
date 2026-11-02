import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import {
  EHexobjectGroup,
  type ICreature,
  type ISquad,
  type THexobject,
} from '../abstraction/hexobject-abstraction';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { getMeta } from '../content/content-accessors';
import { isTraversableTile } from '../hero-movement/movement-grid';
import { coordinateKey, getHexNeighbors, hexDistance } from '../utils/hex-utils';
import { squadThreat, type Threat, type ThreatProfile } from '../battle/threat';

export type SquadObject = Extract<THexobject, { groupType: EHexobjectGroup.CREATURE }> & {
  creature: ICreature & { squad: ISquad };
};

export interface PlacedSquad {
  tile: HexTileModel;
  squad: SquadObject;
}

export interface SquadView {
  id: string;
  hexobjectKey: THexobjectKey;
  coordinates: IHexCoordinates;
  title: string;
  scouted: boolean;
  count: number;
  leaderKind: string;
  members: (string | null)[];
  threat: Threat;
  watcher: boolean;
  boss: boolean;
}

export function asSquad(obj: THexobject | null | undefined): SquadObject | null {
  if (obj?.groupType !== EHexobjectGroup.CREATURE || !obj.creature.squad) return null;
  return obj as SquadObject;
}

export function placedSquads(map: HexMapModel): PlacedSquad[] {
  return map.tiles.flatMap((tile) => {
    const squad = asSquad(tile.hexobject);
    return squad ? [{ tile, squad }] : [];
  });
}

export function findSquad(map: HexMapModel, squadId: string): PlacedSquad | null {
  return placedSquads(map).find((p) => p.squad.id === squadId) ?? null;
}

export function isAdjacent(a: IHexCoordinates, b: IHexCoordinates): boolean {
  return hexDistance(a, b) === 1;
}

export function compositionKnown(squad: SquadObject): boolean {
  return !!squad.creature.scouted || squad.creature.squad.members.length === 1;
}

export function viewSquad(placed: PlacedSquad, hero: ThreatProfile): SquadView {
  const { squad, tile } = placed;
  const def = squad.creature.squad;
  const known = compositionKnown(squad);
  return {
    id: squad.id,
    hexobjectKey: squad.hexobjectKey,
    coordinates: { ...tile.coordinates },
    title: getMeta(squad.hexobjectKey).title,
    scouted: known,
    count: def.members.length,
    leaderKind: def.members[0],
    members: def.members.map((kind, i) => (known || i === 0 ? kind : null)),
    threat: squadThreat(def.members, hero),
    watcher: def.watcher,
    boss: def.boss,
  };
}

export function projectSquads(map: HexMapModel, hero: ThreatProfile): SquadView[] {
  return placedSquads(map)
    .filter((p) => p.tile.isRevealed)
    .map((p) => viewSquad(p, hero));
}

function tileAt(map: HexMapModel, coord: IHexCoordinates): HexTileModel | undefined {
  const key = coordinateKey(coord);
  return map.tiles.find((t) => coordinateKey(t.coordinates) === key);
}

function watchers(map: HexMapModel): PlacedSquad[] {
  return placedSquads(map).filter((p) => p.squad.creature.squad.watcher);
}

export function watchedHexes(map: HexMapModel): IHexCoordinates[] {
  return watchers(map)
    .flatMap((p) => getHexNeighbors(p.tile.coordinates))
    .filter((coord) => isTraversableTile(tileAt(map, coord)));
}

export function watchingSquad(map: HexMapModel, at: IHexCoordinates): PlacedSquad | null {
  return watchers(map).find((p) => isAdjacent(p.tile.coordinates, at)) ?? null;
}
