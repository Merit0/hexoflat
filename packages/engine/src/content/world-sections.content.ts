import type {
  TWorldTerrainKey,
  WorldSectionDef,
  WorldSectionHex,
  WorldSectionSeam,
} from './world-section-schema';

const key = (q: number, r: number) => `${q},${r}`;

function disc(radius: number, terrain: TWorldTerrainKey, omit: string[] = []): WorldSectionHex[] {
  const skip = new Set(omit);
  const out: WorldSectionHex[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > radius) continue;
      if (skip.has(key(q, r))) continue;
      out.push({ q, r, terrain });
    }
  }
  return out;
}

function paint(
  hexes: WorldSectionHex[],
  keys: string[],
  terrain: TWorldTerrainKey,
): WorldSectionHex[] {
  const set = new Set(keys);
  return hexes.map((h) => (set.has(key(h.q, h.r)) ? { ...h, terrain } : h));
}

const R2_SEAMS: Record<number, WorldSectionSeam> = {
  0: { q: 2, r: 0, dir: 0 },
  1: { q: 2, r: -2, dir: 1 },
  2: { q: 0, r: -2, dir: 2 },
  3: { q: -2, r: 0, dir: 3 },
  4: { q: -2, r: 2, dir: 4 },
  5: { q: 0, r: 2, dir: 5 },
};

const r2 = (dirs: number[]): WorldSectionSeam[] => dirs.map((d) => R2_SEAMS[d]);

export const WORLD_SECTIONS: WorldSectionDef[] = [
  {
    key: 'camp-field',
    class: 'AREA',
    tags: ['CAMP_ANCHOR'],
    allowRotation: false,
    weight: 1,
    hexes: disc(2, 'OPEN_GROUND'),
    seams: r2([0, 2, 3, 5]),
  },
  {
    key: 'broad-field',
    class: 'AREA',
    tags: ['OPEN_FIELD'],
    allowRotation: true,
    weight: 4,
    hexes: disc(2, 'OPEN_GROUND'),
    seams: r2([0, 1, 2, 3, 4, 5]),
  },
  {
    key: 'open-meadow',
    class: 'AREA',
    tags: ['OPEN_FIELD'],
    allowRotation: true,
    weight: 3,
    hexes: disc(2, 'OPEN_GROUND', [key(2, -2), key(2, -1)]),
    seams: r2([0, 2, 3, 4, 5]),
  },
  {
    key: 'woodland',
    class: 'AREA',
    tags: ['WOODED', 'OPEN_FIELD'],
    allowRotation: true,
    weight: 3,
    hexes: paint(
      disc(2, 'FOREST_EDGE'),
      disc(1, 'OPEN_GROUND').map((h) => key(h.q, h.r)),
      'OPEN_GROUND',
    ),
    seams: r2([0, 1, 3, 4, 5]),
  },
  {
    key: 'ridge-bowl',
    class: 'AREA',
    tags: ['RIDGE_FIELD', 'OPEN_FIELD'],
    allowRotation: true,
    weight: 3,
    hexes: paint(disc(2, 'OPEN_GROUND'), [key(0, 0), key(1, 0), key(0, 1)], 'STONE_RIDGE'),
    seams: r2([0, 1, 2, 3, 4, 5]),
  },
  {
    key: 'broken-basin',
    class: 'AREA',
    tags: ['BROKEN', 'RIDGE_FIELD'],
    allowRotation: true,
    weight: 2,
    hexes: paint(disc(2, 'BROKEN_GROUND'), [key(-1, 0), key(-1, 1)], 'STONE_RIDGE'),
    seams: r2([0, 1, 2, 4, 5]),
  },
  {
    key: 'hollow',
    class: 'AREA',
    tags: ['POCKET'],
    allowRotation: true,
    weight: 2,
    hexes: disc(1, 'POCKET_FLOOR'),
    seams: [{ q: -1, r: 0, dir: 3 }],
  },
  {
    key: 'wide-hollow',
    class: 'AREA',
    tags: ['POCKET'],
    allowRotation: true,
    weight: 1,
    hexes: [...disc(1, 'POCKET_FLOOR'), { q: 2, r: 0, terrain: 'POCKET_FLOOR' }],
    seams: [{ q: -1, r: 0, dir: 3 }],
  },
  {
    key: 'frontier-plain',
    class: 'AREA',
    tags: ['FRONTIER_FIELD', 'OPEN_FIELD'],
    allowRotation: true,
    weight: 2,
    hexes: disc(2, 'FRONTIER_EDGE', [key(2, -2), key(1, -2)]),
    seams: r2([0, 2, 3, 4, 5]),
  },
  {
    key: 'frontier-shelf',
    class: 'AREA',
    tags: ['FRONTIER_FIELD'],
    allowRotation: true,
    weight: 2,
    hexes: paint(
      disc(2, 'FRONTIER_EDGE', [key(1, 1), key(2, -1)]),
      [key(-1, 0), key(-1, 1)],
      'STONE_RIDGE',
    ),
    seams: r2([1, 2, 3, 4, 5]),
  },
  {
    key: 'ridge-spur',
    class: 'AREA',
    tags: ['RIDGE_FIELD'],
    allowRotation: true,
    weight: 2,
    hexes: paint(disc(2, 'OPEN_GROUND'), [key(0, 0), key(0, 1), key(1, -1)], 'STONE_RIDGE'),
    seams: r2([0, 1, 2, 4, 5]),
  },
  {
    key: 'gate',
    class: 'LINK',
    tags: ['LINK'],
    allowRotation: true,
    weight: 3,
    hexes: [{ q: 0, r: 0, terrain: 'NARROW_PASS' }],
    seams: [
      { q: 0, r: 0, dir: 3 },
      { q: 0, r: 0, dir: 0 },
    ],
  },
  {
    key: 'pass',
    class: 'LINK',
    tags: ['LINK'],
    allowRotation: true,
    weight: 3,
    hexes: [
      { q: 0, r: 0, terrain: 'NARROW_PASS' },
      { q: 1, r: 0, terrain: 'NARROW_PASS' },
    ],
    seams: [
      { q: 0, r: 0, dir: 3 },
      { q: 1, r: 0, dir: 0 },
    ],
  },
  {
    key: 'bend',
    class: 'LINK',
    tags: ['LINK'],
    allowRotation: true,
    weight: 2,
    hexes: [
      { q: 0, r: 0, terrain: 'NARROW_PASS' },
      { q: 1, r: 0, terrain: 'NARROW_PASS' },
      { q: 1, r: 1, terrain: 'NARROW_PASS' },
    ],
    seams: [
      { q: 0, r: 0, dir: 3 },
      { q: 1, r: 1, dir: 5 },
    ],
  },
];
