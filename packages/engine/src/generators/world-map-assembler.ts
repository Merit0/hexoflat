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
import { pickRandom, type RandomNumberGenerator } from '../utils/random';
import type {
  TWorldSectionTag,
  TWorldTerrainKey,
  WorldSectionDef,
} from '../content/world-section-schema';

export interface OpenSeam {
  coord: IHexCoordinates;
  dir: number;
}

export interface PlacedSection {
  key: string;
  tags: TWorldSectionTag[];
  rotation: number;
  anchor: IHexCoordinates;
}

export interface AssembledWorld {
  seed: string;
  map: HexMapModel;
  terrainByCoord: Record<string, TWorldTerrainKey>;
  placedSections: PlacedSection[];
  openSeams: OpenSeam[];
}

export interface AssembleInput {
  seed: string;
  sections: WorldSectionDef[];
  startSectionKey?: string;
  maxSections: number;
  requiredTags?: TWorldSectionTag[];
}

interface PlacedHex {
  axial: Axial;
  terrain: TWorldTerrainKey;
}

interface WorldSeam {
  axial: Axial;
  dir: number;
}

interface SectionAnchor {
  key: string;
  tags: TWorldSectionTag[];
  rotation: number;
  anchor: Axial;
}

interface Candidate {
  seam: WorldSeam;
  section: WorldSectionDef;
  rotation: number;
  matchedSeamIndex: number;
  offset: Axial;
  hexes: PlacedHex[];
  otherSeams: WorldSeam[];
}

const axialKey = (a: Axial): string => `${a.q}:${a.r}`;
const seamKey = (s: WorldSeam): string => `${s.axial.q}:${s.axial.r}:${s.dir}`;
const translate = (a: Axial, by: Axial): Axial => ({ q: a.q + by.q, r: a.r + by.r });

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
): { hexes: PlacedHex[]; seams: WorldSeam[] } {
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
  used: Set<string>,
  placed: Map<string, PlacedHex>,
): Candidate[] {
  const wantDir = oppositeDir(worldSeam.dir);
  const target = axialNeighbor(worldSeam.axial, worldSeam.dir);
  const out: Candidate[] = [];

  for (const section of deck) {
    if (used.has(section.key)) continue;
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

function seamFacesEmpty(seam: WorldSeam, placed: Map<string, PlacedHex>): boolean {
  return !placed.has(axialKey(axialNeighbor(seam.axial, seam.dir)));
}

function grow(
  deck: WorldSectionDef[],
  maxSections: number,
  rng: RandomNumberGenerator,
  placed: Map<string, PlacedHex>,
  used: Set<string>,
  anchors: SectionAnchor[],
  openSeams: WorldSeam[],
  requiredTags: TWorldSectionTag[],
): WorldSeam[] {
  let seams = openSeams;
  let stepIndex = 0;

  while (anchors.length < maxSections) {
    const requiredTag = requiredTags[stepIndex] as TWorldSectionTag | undefined;
    const candidates = seams
      .flatMap((s) => candidatesForSeam(s, deck, used, placed))
      .filter((c) => !requiredTag || c.section.tags.includes(requiredTag));

    if (candidates.length === 0) {
      if (requiredTag) {
        stepIndex += 1;
        continue;
      }
      break;
    }

    sortCandidates(candidates);
    const chosen = pickRandom(candidates, rng)!;

    for (const h of chosen.hexes) placed.set(axialKey(h.axial), h);
    used.add(chosen.section.key);
    anchors.push({
      key: chosen.section.key,
      tags: chosen.section.tags,
      rotation: chosen.rotation,
      anchor: chosen.offset,
    });

    seams = [
      ...seams.filter((s) => seamKey(s) !== seamKey(chosen.seam)),
      ...chosen.otherSeams,
    ].filter((s) => seamFacesEmpty(s, placed));
    stepIndex += 1;
  }

  return seams;
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
  const { seed, sections, maxSections } = input;
  const rng = deriveStream(seed, 'world-map');

  const placed = new Map<string, PlacedHex>();
  const used = new Set<string>();
  const anchors: SectionAnchor[] = [];

  const start = pickStartSection(sections, input.startSectionKey);
  const startTransformed = transformSection(start, 0, { q: 0, r: 0 });
  for (const h of startTransformed.hexes) placed.set(axialKey(h.axial), h);
  used.add(start.key);
  anchors.push({ key: start.key, tags: start.tags, rotation: 0, anchor: { q: 0, r: 0 } });

  const finalSeams = grow(
    sections,
    maxSections,
    rng,
    placed,
    used,
    anchors,
    startTransformed.seams.filter((s) => seamFacesEmpty(s, placed)),
    input.requiredTags ?? [],
  );

  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const { axial } of placed.values()) {
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

  const { map, terrainByCoord } = toHexMap(placed, shift);
  map.width = maxCol - colShift + 1;
  map.height = maxRow - minRow + 1;

  const openSeams = finalSeams
    .map((s) => ({ coord: shift(axialToOddQ(s.axial)), dir: s.dir }))
    .sort((a, b) => coordinateKey(a.coord).localeCompare(coordinateKey(b.coord)) || a.dir - b.dir);

  const placedSections = anchors.map((p) => ({
    key: p.key,
    tags: p.tags,
    rotation: p.rotation,
    anchor: shift(axialToOddQ(p.anchor)),
  }));

  return { seed, map, terrainByCoord, placedSections, openSeams };
}
