import HexMapModel from '../map/models/hex-map-model';
import { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { Complexity } from '../enums/complexity';
import {
  type Axial,
  axialNeighbor,
  axialToOddQ,
  coordinateKey,
  oppositeDir,
  rotateAxial,
  rotateDir,
} from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';
import { type RandomNumberGenerator } from '../utils/random';
import type {
  TWorldSectionClass,
  TWorldSectionTag,
  TWorldTerrainKey,
  WorldSectionDef,
} from '../content/world-section-schema';
import {
  type GrowState,
  type PlacedHex,
  type SectionAnchor,
  type WorldSeam,
  axialKey,
  closeLoops,
  fillConcavities,
  sealHoles,
  seamKey,
  translate,
} from './world-map-assembler-core';

export interface OpenSeam {
  coord: IHexCoordinates;
  dir: number;
}

export interface PlacedSection {
  id: number;
  key: string;
  class: TWorldSectionClass;
  tags: TWorldSectionTag[];
  rotation: number;
  anchor: IHexCoordinates;
  hexes: IHexCoordinates[];
}

export interface SectionGraph {
  nodes: { id: number; key: string; class: TWorldSectionClass }[];
  edges: [number, number][];
  bridgeEdges: [number, number][];
}

export interface AssembledWorld {
  seed: string;
  map: HexMapModel;
  terrainByCoord: Record<string, TWorldTerrainKey>;
  placedSections: PlacedSection[];
  openSeams: OpenSeam[];
  sectionGraph: SectionGraph;
  loopsClosed: number;
}

export interface AssembleInput {
  seed: string;
  sections: WorldSectionDef[];
  startSectionKey?: string;
  maxSections: number;
  requiredTags?: TWorldSectionTag[];
  targetHexes?: number;
  maxHexes?: number;
  targetLoops?: number;
  minAreas?: number;
}

interface Candidate {
  seam: WorldSeam;
  section: WorldSectionDef;
  rotation: number;
  matchedSeamIndex: number;
  offset: Axial;
  hexes: PlacedHex[];
  otherSeams: { axial: Axial; dir: number }[];
}

function pickStartSection(sections: WorldSectionDef[], startKey?: string): WorldSectionDef {
  const start = startKey
    ? sections.find((s) => s.key === startKey)
    : sections.find((s) => s.tags.includes('CAMP_ANCHOR'));

  if (!start) {
    throw new Error(
      startKey
        ? `assembleWorld: no section "${startKey}" in the deck`
        : 'assembleWorld: the deck has no CAMP_ANCHOR section',
    );
  }
  return start;
}

function transformSection(
  section: WorldSectionDef,
  rotation: number,
  offset: Axial,
): { hexes: PlacedHex[]; seams: { axial: Axial; dir: number }[] } {
  const hexes = section.hexes.map((h) => ({
    axial: translate(rotateAxial({ q: h.q, r: h.r }, rotation), offset),
    terrain: h.terrain,
  }));
  const seams = section.seams.map((s) => ({
    axial: translate(rotateAxial({ q: s.q, r: s.r }, rotation), offset),
    dir: rotateDir(s.dir, rotation),
  }));
  return { hexes, seams };
}

function candidatesForSeam(
  worldSeam: WorldSeam,
  deck: WorldSectionDef[],
  wantClass: TWorldSectionClass,
  placed: Map<string, PlacedHex>,
): Candidate[] {
  const wantDir = oppositeDir(worldSeam.dir);
  const target = axialNeighbor(worldSeam.axial, worldSeam.dir);
  const out: Candidate[] = [];

  for (const section of deck) {
    if (section.class !== wantClass) continue;
    const rotations = section.allowRotation ? [0, 1, 2, 3, 4, 5] : [0];

    for (const rotation of rotations) {
      section.seams.forEach((seam, seamIndex) => {
        if (rotateDir(seam.dir, rotation) !== wantDir) return;

        const rotatedSeamHex = rotateAxial({ q: seam.q, r: seam.r }, rotation);
        const offset = { q: target.q - rotatedSeamHex.q, r: target.r - rotatedSeamHex.r };
        const { hexes, seams } = transformSection(section, rotation, offset);

        if (hexes.some((h) => placed.has(axialKey(h.axial)))) return;

        out.push({
          seam: worldSeam,
          section,
          rotation,
          matchedSeamIndex: seamIndex,
          offset,
          hexes,
          otherSeams: seams.filter((_, i) => i !== seamIndex),
        });
      });
    }
  }
  return out;
}

function sortCandidates(candidates: Candidate[]): void {
  candidates.sort((a, b) => {
    const seamCmp = seamKey(a.seam).localeCompare(seamKey(b.seam));
    if (seamCmp !== 0) return seamCmp;
    if (a.section.key !== b.section.key) return a.section.key < b.section.key ? -1 : 1;
    if (a.rotation !== b.rotation) return a.rotation - b.rotation;
    return a.matchedSeamIndex - b.matchedSeamIndex;
  });
}

function weightedPick(
  candidates: Candidate[],
  useCount: Map<string, number>,
  placed: Map<string, PlacedHex>,
  rng: RandomNumberGenerator,
): Candidate {
  const weights = candidates.map(
    (c) =>
      (c.section.weight / ((useCount.get(c.section.key) ?? 0) + 1)) *
      (1 + adjacencyScore(c.hexes, placed)),
  );
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i += 1) {
    roll -= weights[i];
    if (roll < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function seamFacesEmpty(
  seam: { axial: Axial; dir: number },
  placed: Map<string, PlacedHex>,
): boolean {
  return !placed.has(axialKey(axialNeighbor(seam.axial, seam.dir)));
}

function adjacencyScore(hexes: PlacedHex[], placed: Map<string, PlacedHex>): number {
  let score = 0;
  for (const h of hexes) {
    for (let dir = 0; dir < 6; dir += 1) {
      if (placed.has(axialKey(axialNeighbor(h.axial, dir)))) score += 1;
    }
  }
  return score * 2;
}

function grow(
  deck: WorldSectionDef[],
  input: AssembleInput,
  rng: RandomNumberGenerator,
  state: GrowState,
): void {
  const requiredTags = input.requiredTags ?? [];
  const targetHexes = input.targetHexes ?? 45;
  const maxHexes = input.maxHexes ?? 80;
  const minAreas = input.minAreas ?? 4;
  let areaStep = 0;

  while (state.anchors.length < input.maxSections && state.placed.size < maxHexes) {
    const tagPending = areaStep < requiredTags.length;
    const areaCount = state.anchors.filter(
      (a) => a.class === 'AREA' && !a.tags.includes('POCKET'),
    ).length;
    const needMoreAreas = areaCount < minAreas;
    const done = state.placed.size >= targetHexes && !tagPending && !needMoreAreas;
    if (done) break;
    const restrictToTag = tagPending && state.placed.size >= targetHexes;

    const candidates: Candidate[] = [];
    for (const worldSeam of state.seams) {
      const wantClass: TWorldSectionClass = worldSeam.ownerClass === 'AREA' ? 'LINK' : 'AREA';
      let cands = candidatesForSeam(worldSeam, deck, wantClass, state.placed);
      if (wantClass === 'AREA' && tagPending) {
        const filtered = cands.filter((c) => c.section.tags.includes(requiredTags[areaStep]));
        cands = filtered.length || restrictToTag ? filtered : cands;
      }
      candidates.push(...cands);
    }

    if (candidates.length === 0) break;

    sortCandidates(candidates);
    const chosen = weightedPick(candidates, state.useCount, state.placed, rng);
    const id = state.anchors.length;

    for (const h of chosen.hexes) state.placed.set(axialKey(h.axial), h);
    state.anchors.push({
      id,
      key: chosen.section.key,
      class: chosen.section.class,
      tags: chosen.section.tags,
      rotation: chosen.rotation,
      anchor: chosen.offset,
      hexes: chosen.hexes.map((h) => h.axial),
    });
    state.useCount.set(chosen.section.key, (state.useCount.get(chosen.section.key) ?? 0) + 1);
    state.edges.push([chosen.seam.ownerId, id]);
    if (chosen.section.class === 'AREA') areaStep += 1;

    state.seams = [
      ...state.seams.filter((s) => seamKey(s) !== seamKey(chosen.seam)),
      ...chosen.otherSeams.map((s) => ({
        axial: s.axial,
        dir: s.dir,
        ownerId: id,
        ownerClass: chosen.section.class,
      })),
    ].filter((s) => seamFacesEmpty(s, state.placed));
  }
}

function toHexMap(placed: Map<string, PlacedHex>, shift: (c: IHexCoordinates) => IHexCoordinates) {
  const rows = [...placed.values()]
    .map(({ axial, terrain }) => ({ coord: shift(axialToOddQ(axial)), terrain }))
    .sort((a, b) => coordinateKey(a.coord).localeCompare(coordinateKey(b.coord)));

  const map = new HexMapModel();
  map.name = 'world-map-mvp';
  map.complexity = Complexity.NORMAL;
  map.config = [];
  map.fogPolicy = 'FOG';

  map.tiles = rows.map(({ coord }) => {
    const tile = new HexTileModel();
    tile.tileId = coordinateKey(coord);
    tile.coordinates = coord;
    tile.isRevealed = false;
    tile.hexBackgroundImagePath = '';
    tile.hexobject = null;
    return tile;
  });

  const terrainByCoord: Record<string, TWorldTerrainKey> = {};
  for (const { coord, terrain } of rows) terrainByCoord[coordinateKey(coord)] = terrain;

  return { map, terrainByCoord };
}

export function assembleWorld(input: AssembleInput): AssembledWorld {
  const { seed, sections } = input;
  const rng = deriveStream(seed, 'world-map');

  const start = pickStartSection(sections, input.startSectionKey);
  const startTransformed = transformSection(start, 0, { q: 0, r: 0 });

  const state: GrowState = {
    placed: new Map<string, PlacedHex>(),
    anchors: [],
    edges: [],
    bridgeEdges: [],
    useCount: new Map<string, number>([[start.key, 1]]),
    seams: [],
  };
  for (const h of startTransformed.hexes) state.placed.set(axialKey(h.axial), h);
  state.anchors.push({
    id: 0,
    key: start.key,
    class: start.class,
    tags: start.tags,
    rotation: 0,
    anchor: { q: 0, r: 0 },
    hexes: startTransformed.hexes.map((h) => h.axial),
  });
  state.seams = startTransformed.seams
    .filter((s) => seamFacesEmpty(s, state.placed))
    .map((s) => ({ axial: s.axial, dir: s.dir, ownerId: 0, ownerClass: start.class }));

  grow(sections, input, rng, state);
  const loopsClosed = closeLoops(state, input.targetLoops ?? 2);
  fillConcavities(state, 2, 4);
  sealHoles(state);

  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const { axial } of state.placed.values()) {
    const c = axialToOddQ(axial);
    minCol = Math.min(minCol, c.columnIndex);
    minRow = Math.min(minRow, c.rowIndex);
    maxCol = Math.max(maxCol, c.columnIndex);
    maxRow = Math.max(maxRow, c.rowIndex);
  }
  const colShift = minCol - (minCol & 1);
  const shift = (c: IHexCoordinates): IHexCoordinates => ({
    columnIndex: c.columnIndex - colShift,
    rowIndex: c.rowIndex - minRow,
  });

  const { map, terrainByCoord } = toHexMap(state.placed, shift);
  map.width = maxCol - colShift + 1;
  map.height = maxRow - minRow + 1;

  const openSeams = state.seams
    .map((s) => ({ coord: shift(axialToOddQ(s.axial)), dir: s.dir }))
    .sort((a, b) => coordinateKey(a.coord).localeCompare(coordinateKey(b.coord)) || a.dir - b.dir);

  const placedSections: PlacedSection[] = state.anchors.map((p) => ({
    id: p.id,
    key: p.key,
    class: p.class,
    tags: p.tags,
    rotation: p.rotation,
    anchor: shift(axialToOddQ(p.anchor)),
    hexes: p.hexes.map((h) => shift(axialToOddQ(h))),
  }));

  const sectionGraph: SectionGraph = {
    nodes: state.anchors.map((p) => ({ id: p.id, key: p.key, class: p.class })),
    edges: state.edges,
    bridgeEdges: state.bridgeEdges,
  };

  return { seed, map, terrainByCoord, placedSections, openSeams, sectionGraph, loopsClosed };
}
