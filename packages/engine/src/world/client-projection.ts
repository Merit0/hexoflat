import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { SerializedWorld } from './server-world';
import type { TileDiff } from './tile-diff';

interface SquadBlock {
  members: string[];
  loot: string;
}

function squadOf(tile: object): { creature: Record<string, unknown>; squad: SquadBlock } | null {
  const creature = (
    (tile as { hexobject?: unknown }).hexobject as { creature?: Record<string, unknown> } | null
  )?.creature;
  const squad = creature?.squad as SquadBlock | undefined;
  return creature && squad && Array.isArray(squad.members) ? { creature, squad } : null;
}

export function projectTileForClient<T extends object>(tile: T): T {
  const found = squadOf(tile);
  if (!found || found.creature.scouted === true || found.squad.members.length <= 1) return tile;
  const copy = structuredClone(tile);
  const hidden = squadOf(copy)!.squad;
  const leader = hidden.members[0];
  hidden.members = hidden.members.map(() => leader);
  hidden.loot = HEXOBJECT_KEYS.HAND;
  return copy;
}

export function projectDiffsForClient(diffs: readonly TileDiff[]): TileDiff[] {
  return diffs.map((diff) => ({ ...diff, tile: projectTileForClient(diff.tile) }));
}

export function projectWorldForClient(world: SerializedWorld): SerializedWorld {
  return {
    ...world,
    map: { ...world.map, tiles: world.map.tiles.map(projectTileForClient) },
    battle: null,
  };
}
