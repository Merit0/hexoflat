import { sha256Hex } from '../utils/hash/sha256';
import type { SerializedWorld } from './server-world';
import type { TileDiff } from './tile-diff';

interface SquadBlock {
  members: string[];
}

function squadOf(tile: object): { creature: Record<string, unknown>; squad: SquadBlock } | null {
  const creature = (
    (tile as { hexobject?: unknown }).hexobject as { creature?: Record<string, unknown> } | null
  )?.creature;
  const squad = creature?.squad as SquadBlock | undefined;
  return creature && squad && Array.isArray(squad.members) ? { creature, squad } : null;
}

function withoutLootTable<T extends object>(tile: T): T {
  const construction = (
    (tile as { hexobject?: unknown }).hexobject as { construction?: Record<string, unknown> } | null
  )?.construction;
  if (!construction || !('lootTableId' in construction)) return tile;
  const copy = structuredClone(tile);
  const hidden = (copy as { hexobject: { construction: Record<string, unknown> } }).hexobject;
  delete hidden.construction.lootTableId;
  return copy;
}

function withoutContainer<T extends object>(tile: T): T {
  const object = (tile as { hexobject?: unknown }).hexobject as Record<string, unknown> | null;
  if (!object || !('container' in object)) return tile;
  const copy = structuredClone(tile);
  delete (copy as { hexobject: Record<string, unknown> }).hexobject.container;
  return copy;
}

export function projectTileForClient<T extends object>(tile: T): T {
  const clean = withoutContainer(withoutLootTable(tile));
  const found = squadOf(clean);
  if (!found || found.creature.scouted === true || found.squad.members.length <= 1) return clean;
  const copy = structuredClone(clean);
  const hidden = squadOf(copy)!.squad;
  const leader = hidden.members[0];
  hidden.members = hidden.members.map(() => leader);
  return copy;
}

export function projectDiffsForClient(diffs: readonly TileDiff[]): TileDiff[] {
  return diffs.map((diff) => ({ ...diff, tile: projectTileForClient(diff.tile) }));
}

export function cosmeticSeedFor(serverSeed: string): string {
  return sha256Hex(`cosmetic:${serverSeed}`);
}

function projectDescriptorForClient(descriptor: unknown): unknown {
  if (!descriptor || typeof descriptor !== 'object' || !('seed' in descriptor)) return descriptor;
  const { seed } = descriptor;
  return typeof seed === 'string' ? { ...descriptor, seed: cosmeticSeedFor(seed) } : descriptor;
}

export function projectWorldForClient(world: SerializedWorld): SerializedWorld {
  return {
    ...world,
    worldSeed: cosmeticSeedFor(world.worldSeed),
    descriptor: projectDescriptorForClient(world.descriptor),
    map: { ...world.map, tiles: world.map.tiles.map(projectTileForClient) },
    battle: null,
  };
}
