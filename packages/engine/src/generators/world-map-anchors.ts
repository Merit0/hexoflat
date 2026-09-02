import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { coordinateKey, getOddQNeighbors } from '../utils/hex-utils';
import { WORLD_TERRAIN } from '../content/world-terrain.content';
import type { FrontierPromise, TWorldTerrainKey } from '../content/world-section-schema';
import { deriveStream } from '../utils/random-seeded';
import { pickRandom, type RandomNumberGenerator } from '../utils/random';
import type { AssembledWorld } from './world-map-assembler';

export const GAMEPLAY_ANCHOR_KINDS = [
  'LANDMARK_SLOT',
  'OBSTACLE_SLOT',
  'TERRAIN_INTERACTION_SLOT',
  'RESOURCE_HINT_SLOT',
  'SHORTCUT_SLOT',
  'SIDE_INTEREST_SLOT',
] as const;

export type TGameplayAnchorKind = (typeof GAMEPLAY_ANCHOR_KINDS)[number];

export interface GameplayAnchor {
  id: string;
  coord: IHexCoordinates;
  kind: TGameplayAnchorKind;
}

const INTERACTION_KINDS: TGameplayAnchorKind[] = [
  'TERRAIN_INTERACTION_SLOT',
  'RESOURCE_HINT_SLOT',
  'SIDE_INTEREST_SLOT',
];

function coordsWithTerrain(world: AssembledWorld, terrain: TWorldTerrainKey): IHexCoordinates[] {
  return world.map.tiles
    .filter((t) => world.terrainByCoord[coordinateKey(t.coordinates)] === terrain)
    .map((t) => ({ ...t.coordinates }));
}

function hasPassableNeighbour(coord: IHexCoordinates, passable: Set<string>): boolean {
  return getOddQNeighbors(coord).some((n) => passable.has(coordinateKey(n)));
}

function passableSet(world: AssembledWorld): Set<string> {
  return new Set(
    world.map.tiles
      .filter((t) => {
        const terrain = world.terrainByCoord[coordinateKey(t.coordinates)];
        return !terrain || WORLD_TERRAIN[terrain].traversability !== 'BLOCKED';
      })
      .map((t) => coordinateKey(t.coordinates)),
  );
}

function pickInteractionCoord(
  candidates: IHexCoordinates[],
  passable: Set<string>,
  rng: RandomNumberGenerator,
): IHexCoordinates | null {
  const usable = candidates.filter((c) => hasPassableNeighbour(c, passable));
  return usable.length ? pickRandom(usable, rng) : null;
}

export function reserveAnchors(
  world: AssembledWorld,
  promises: FrontierPromise[],
  seed: string,
): GameplayAnchor[] {
  const rng = deriveStream(seed, 'anchors');
  const passable = passableSet(world);
  const anchors: GameplayAnchor[] = [];

  const add = (kind: TGameplayAnchorKind, coord: IHexCoordinates | null | undefined) => {
    if (!coord) return;
    anchors.push({ id: `anchor-${anchors.length}`, coord: { ...coord }, kind });
  };

  const ridge = pickRandom(coordsWithTerrain(world, 'STONE_RIDGE'), rng);
  if (ridge) {
    const beside = getOddQNeighbors(ridge).find((n) => passable.has(coordinateKey(n)));
    add('TERRAIN_INTERACTION_SLOT', beside);
  }
  add(
    'SIDE_INTEREST_SLOT',
    pickInteractionCoord(coordsWithTerrain(world, 'POCKET_FLOOR'), passable, rng),
  );
  add(
    'RESOURCE_HINT_SLOT',
    pickInteractionCoord(coordsWithTerrain(world, 'FOREST_EDGE'), passable, rng),
  );

  const strongest = [...promises].sort((a, b) => rankStrength(b) - rankStrength(a))[0];
  if (strongest) {
    const beyond = getOddQNeighbors(strongest.seam.coord)[strongest.seam.dir];
    add('LANDMARK_SLOT', beyond);
  }

  if (world.openSeams.length > 1) add('SHORTCUT_SLOT', world.openSeams[1].coord);

  const obstacle =
    pickRandom(coordsWithTerrain(world, 'BROKEN_GROUND'), rng) ??
    pickRandom(coordsWithTerrain(world, 'STONE_RIDGE'), rng);
  add('OBSTACLE_SLOT', obstacle);

  return anchors;
}

function rankStrength(p: FrontierPromise): number {
  return p.strength === 'STRONG' ? 2 : p.strength === 'MEDIUM' ? 1 : 0;
}

export function interactionAnchorsHavePassableNeighbour(
  world: AssembledWorld,
  anchors: GameplayAnchor[],
): boolean {
  const passable = passableSet(world);
  return anchors
    .filter((a) => INTERACTION_KINDS.includes(a.kind))
    .every((a) => hasPassableNeighbour(a.coord, passable));
}
