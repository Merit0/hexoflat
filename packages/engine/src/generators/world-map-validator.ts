import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { coordinateKey, getOddQNeighbors, oddQToAxial } from '../utils/hex-utils';
import { WORLD_SECTIONS } from '../content/world-sections.content';
import { WORLD_TERRAIN } from '../content/world-terrain.content';
import type { FrontierPromise, TWorldSectionTag } from '../content/world-section-schema';
import type { AssembledWorld } from './world-map-assembler';
import type { WorldMapMvpConfig } from './world-map-config';

export interface WorldValidationMetrics {
  hexCount: number;
  branchCount: number;
  chokepointCount: number;
  openAreaSize: number;
  pocketSize: number;
  symmetryOffset: number;
  promiseCount: number;
}

export interface WorldValidation {
  accepted: boolean;
  score: number;
  rejectionReasons: string[];
  metrics: WorldValidationMetrics;
}

export interface ValidateWorldInput {
  world: AssembledWorld;
  campAnchor: IHexCoordinates;
  config: WorldMapMvpConfig;
  requiredTags: TWorldSectionTag[];
  promises: FrontierPromise[];
}

function isPassable(world: AssembledWorld, key: string): boolean {
  const terrain = world.terrainByCoord[key];
  return !terrain || WORLD_TERRAIN[terrain].traversability !== 'BLOCKED';
}

function passableSet(world: AssembledWorld): Set<string> {
  const present = world.map.tiles.map((t) => coordinateKey(t.coordinates));
  return new Set(present.filter((k) => isPassable(world, k)));
}

function reachableFrom(start: IHexCoordinates, passable: Set<string>): Set<string> {
  const seen = new Set<string>();
  const queue: IHexCoordinates[] = [];
  const startKey = coordinateKey(start);
  if (passable.has(startKey)) {
    seen.add(startKey);
    queue.push(start);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of getOddQNeighbors(cur)) {
      const k = coordinateKey(n);
      if (passable.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return seen;
}

function circularDirDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 6;
  return Math.min(raw, 6 - raw);
}

function sectionOpenHexCount(key: string): number {
  const section = WORLD_SECTIONS.find((s) => s.key === key);
  if (!section) return 0;
  return section.hexes.filter((h) => WORLD_TERRAIN[h.terrain].traversability === 'OPEN').length;
}

function largestSectionSizeWithTag(world: AssembledWorld, tag: TWorldSectionTag): number {
  return world.placedSections
    .filter((p) => p.tags.includes(tag))
    .reduce((max, p) => Math.max(max, sectionOpenHexCount(p.key)), 0);
}

function centroidOffset(world: AssembledWorld, campAnchor: IHexCoordinates): number {
  const anchor = oddQToAxial(campAnchor);
  let sq = 0;
  let sr = 0;
  for (const tile of world.map.tiles) {
    const a = oddQToAxial(tile.coordinates);
    sq += a.q;
    sr += a.r;
  }
  const n = world.map.tiles.length || 1;
  const dq = sq / n - anchor.q;
  const dr = sr / n - anchor.r;
  return Math.sqrt(dq * dq + dr * dr);
}

export function validateWorld(input: ValidateWorldInput): WorldValidation {
  const { world, campAnchor, config, requiredTags, promises } = input;
  const reasons: string[] = [];

  const passable = passableSet(world);
  const reached = reachableFrom(campAnchor, passable);
  const placedTags = new Set(world.placedSections.flatMap((p) => p.tags));
  const seamDirs = world.openSeams.map((s) => s.dir);
  const branchesSpread = seamDirs.some((a, i) =>
    seamDirs.slice(i + 1).some((b) => circularDirDistance(a, b) >= 2),
  );
  const symmetryOffset = centroidOffset(world, campAnchor);
  const anchorHasPassableNeighbour = getOddQNeighbors(campAnchor).some((n) =>
    passable.has(coordinateKey(n)),
  );
  const hasStrongPromise = promises.some((p) => p.strength !== 'SUBTLE');

  if (reached.size !== passable.size) {
    reasons.push(
      `connectivity: ${reached.size}/${passable.size} passable tiles reachable from camp`,
    );
  }
  for (const tag of requiredTags) {
    if (!placedTags.has(tag)) reasons.push(`tag-coverage: no placed section tagged ${tag}`);
  }
  if (world.openSeams.length < 2 || !branchesSpread) {
    reasons.push(`branching: ${world.openSeams.length} open seams, spread=${branchesSpread}`);
  }
  if (!hasStrongPromise) {
    reasons.push('promise: no MEDIUM/STRONG promise on an open seam');
  }
  if (symmetryOffset < config.symmetryRejectThreshold) {
    reasons.push(
      `asymmetry: centroid offset ${symmetryOffset.toFixed(2)} < ${config.symmetryRejectThreshold}`,
    );
  }
  if (!anchorHasPassableNeighbour) {
    reasons.push('no-lock-in: camp anchor has no passable neighbour');
  }

  const metrics: WorldValidationMetrics = {
    hexCount: world.map.tiles.length,
    branchCount: world.openSeams.length,
    chokepointCount: world.placedSections.filter((p) => p.tags.includes('CHOKEPOINT')).length,
    openAreaSize: largestSectionSizeWithTag(world, 'OPEN_AREA'),
    pocketSize: largestSectionSizeWithTag(world, 'POCKET'),
    symmetryOffset,
    promiseCount: promises.length,
  };

  const checks = 6;
  return {
    accepted: reasons.length === 0,
    score: checks - Math.min(checks, new Set(reasons.map((r) => r.split(':')[0])).size),
    rejectionReasons: reasons,
    metrics,
  };
}
