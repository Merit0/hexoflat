import { type Axial, axialNeighbor } from '../utils/hex-utils';
import type {
  TWorldSectionClass,
  TWorldSectionTag,
  TWorldTerrainKey,
} from '../content/world-section-schema';

export interface PlacedHex {
  axial: Axial;
  terrain: TWorldTerrainKey;
}

export interface WorldSeam {
  axial: Axial;
  dir: number;
  ownerId: number;
  ownerClass: TWorldSectionClass;
}

export interface SectionAnchor {
  id: number;
  key: string;
  class: TWorldSectionClass;
  tags: TWorldSectionTag[];
  rotation: number;
  anchor: Axial;
  hexes: Axial[];
}

export interface GrowState {
  placed: Map<string, PlacedHex>;
  anchors: SectionAnchor[];
  edges: [number, number][];
  bridgeEdges: [number, number][];
  useCount: Map<string, number>;
  seams: WorldSeam[];
}

export const axialKey = (a: Axial): string => `${a.q}:${a.r}`;

export const seamKey = (s: { axial: Axial; dir: number }): string =>
  `${s.axial.q}:${s.axial.r}:${s.dir}`;

export const translate = (a: Axial, by: Axial): Axial => ({ q: a.q + by.q, r: a.r + by.r });

export const axialDistance = (a: Axial, b: Axial): number =>
  (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;

const MAX_BRIDGE_HEXES = 5;

function bridgePath(state: GrowState, s1: WorldSeam, s2: WorldSeam): Axial[] | null {
  const t1 = axialNeighbor(s1.axial, s1.dir);
  const t2 = axialNeighbor(s2.axial, s2.dir);
  if (state.placed.has(axialKey(t1)) || state.placed.has(axialKey(t2))) return null;
  if (axialKey(t1) === axialKey(t2)) return [t1];

  const goal = axialKey(t2);
  const seen = new Set<string>([axialKey(t1)]);
  let frontier: { at: Axial; path: Axial[] }[] = [{ at: t1, path: [t1] }];

  for (let step = 0; step < MAX_BRIDGE_HEXES && frontier.length; step += 1) {
    const next: { at: Axial; path: Axial[] }[] = [];
    for (const node of frontier) {
      for (let dir = 0; dir < 6; dir += 1) {
        const n = axialNeighbor(node.at, dir);
        const nk = axialKey(n);
        if (nk === goal) return [...node.path, t2];
        if (seen.has(nk) || state.placed.has(nk)) continue;
        seen.add(nk);
        next.push({ at: n, path: [...node.path, n] });
      }
    }
    next.sort((a, b) => axialKey(a.at).localeCompare(axialKey(b.at)));
    frontier = next;
  }
  return null;
}

export function closeLoops(state: GrowState, targetLoops: number): number {
  const tie = (a: number, b: number): number =>
    seamKey(state.seams[a]).localeCompare(seamKey(state.seams[b]));

  const pairs: [number, number, number][] = [];
  for (let i = 0; i < state.seams.length; i += 1) {
    for (let j = i + 1; j < state.seams.length; j += 1) {
      if (state.seams[i].ownerId === state.seams[j].ownerId) continue;
      pairs.push([i, j, axialDistance(state.seams[i].axial, state.seams[j].axial)]);
    }
  }

  const consumed = new Set<number>();
  let closed = 0;

  const closeFrom = (ordered: [number, number, number][], limit: number): void => {
    for (const [i, j] of ordered) {
      if (closed >= limit) break;
      if (consumed.has(i) || consumed.has(j)) continue;
      const path = bridgePath(state, state.seams[i], state.seams[j]);
      if (!path) continue;
      for (const a of path) state.placed.set(axialKey(a), { axial: a, terrain: 'NARROW_PASS' });
      consumed.add(i);
      consumed.add(j);
      state.bridgeEdges.push([state.seams[i].ownerId, state.seams[j].ownerId]);
      closed += 1;
    }
  };

  const tight = [...pairs].sort((a, b) => a[2] - b[2] || tie(a[0], b[0]) || tie(a[1], b[1]));
  const wide = [...pairs].sort((a, b) => b[2] - a[2] || tie(a[0], b[0]) || tie(a[1], b[1]));
  closeFrom(tight, targetLoops);
  closeFrom(wide, targetLoops + 5);

  state.seams = state.seams.filter((_, idx) => !consumed.has(idx));
  return closed;
}

function enclosingTerrain(gap: Axial, placed: Map<string, PlacedHex>): TWorldTerrainKey {
  let blocked = 0;
  let total = 0;
  for (let dir = 0; dir < 6; dir += 1) {
    const hit = placed.get(axialKey(axialNeighbor(gap, dir)));
    if (!hit) continue;
    total += 1;
    if (hit.terrain === 'STONE_RIDGE') blocked += 1;
  }
  return blocked >= total ? 'STONE_RIDGE' : 'OPEN_GROUND';
}

export function fillConcavities(state: GrowState, passes: number, minFilled: number): void {
  for (let pass = 0; pass < passes; pass += 1) {
    const candidates = new Map<string, Axial>();
    for (const hex of state.placed.values()) {
      for (let dir = 0; dir < 6; dir += 1) {
        const n = axialNeighbor(hex.axial, dir);
        const nk = axialKey(n);
        if (!state.placed.has(nk)) candidates.set(nk, n);
      }
    }
    const toFill: Axial[] = [];
    for (const gap of candidates.values()) {
      let filled = 0;
      for (let dir = 0; dir < 6; dir += 1) {
        if (state.placed.has(axialKey(axialNeighbor(gap, dir)))) filled += 1;
      }
      if (filled >= minFilled) toFill.push(gap);
    }
    if (toFill.length === 0) return;
    for (const gap of toFill) {
      state.placed.set(axialKey(gap), { axial: gap, terrain: enclosingTerrain(gap, state.placed) });
    }
    state.seams = state.seams.filter(
      (s) => !state.placed.has(axialKey(axialNeighbor(s.axial, s.dir))),
    );
  }
}

export function sealHoles(state: GrowState): void {
  let minQ = Infinity;
  let maxQ = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  for (const hex of state.placed.values()) {
    minQ = Math.min(minQ, hex.axial.q);
    maxQ = Math.max(maxQ, hex.axial.q);
    minR = Math.min(minR, hex.axial.r);
    maxR = Math.max(maxR, hex.axial.r);
  }
  minQ -= 1;
  maxQ += 1;
  minR -= 1;
  maxR += 1;
  const inBox = (a: Axial): boolean => a.q >= minQ && a.q <= maxQ && a.r >= minR && a.r <= maxR;

  const exterior = new Set<string>();
  const start: Axial = { q: minQ, r: minR };
  const queue: Axial[] = [start];
  exterior.add(axialKey(start));
  while (queue.length) {
    const cur = queue.shift() as Axial;
    for (let dir = 0; dir < 6; dir += 1) {
      const n = axialNeighbor(cur, dir);
      const nk = axialKey(n);
      if (!inBox(n) || exterior.has(nk) || state.placed.has(nk)) continue;
      exterior.add(nk);
      queue.push(n);
    }
  }

  for (let q = minQ; q <= maxQ; q += 1) {
    for (let r = minR; r <= maxR; r += 1) {
      const a: Axial = { q, r };
      const k = axialKey(a);
      if (state.placed.has(k) || exterior.has(k)) continue;
      state.placed.set(k, { axial: a, terrain: enclosingTerrain(a, state.placed) });
    }
  }

  state.seams = state.seams.filter(
    (s) => !state.placed.has(axialKey(axialNeighbor(s.axial, s.dir))),
  );
}
