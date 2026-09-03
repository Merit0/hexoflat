import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { calcHexPixelPosition, coordinateKey, getOddQNeighbors } from '../utils/hex-utils';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { TWorldArchetypeKey, TWorldTerrainKey } from '../content/world-section-schema';
import { generateWorldMap, type WorldMapMvpResult } from './world-map-generator';

const TILE_W = 60;
const TILE_H = 52;
const PAD = TILE_W;

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/design/samples/world-map-mvp',
);

const PLAN: { archetype: TWorldArchetypeKey; count: number }[] = [
  { archetype: 'FORKED_FRONTIER', count: 3 },
  { archetype: 'RIDGE_AND_POCKET', count: 3 },
  { archetype: 'OPEN_FIELD_NARROW_PASS', count: 2 },
  { archetype: 'LANDMARK_PULL', count: 2 },
];

const TERRAIN_FILL: Record<TWorldTerrainKey, string> = {
  OPEN_GROUND: '#6f7d54',
  FOREST_EDGE: '#3f5a3a',
  BROKEN_GROUND: '#7a6a4f',
  NARROW_PASS: '#8a7f63',
  POCKET_FLOOR: '#5c6b74',
  FRONTIER_EDGE: '#4a4763',
  STONE_RIDGE: '#3a3a40',
};

const PROMISE_FILL: Record<string, string> = {
  SUBTLE: 'rgba(158,195,228,0.28)',
  MEDIUM: 'rgba(158,195,228,0.5)',
  STRONG: 'rgba(158,195,228,0.72)',
};

function hexPoints(x: number, y: number): string {
  return [
    [x + TILE_W * 0.25, y],
    [x + TILE_W * 0.75, y],
    [x + TILE_W, y + TILE_H * 0.5],
    [x + TILE_W * 0.75, y + TILE_H],
    [x + TILE_W * 0.25, y + TILE_H],
    [x, y + TILE_H * 0.5],
  ]
    .map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
    .join(' ');
}

function centreOf(coord: IHexCoordinates): { cx: number; cy: number } {
  const { x, y } = calcHexPixelPosition({ coordinates: coord }, TILE_W, TILE_H);
  return { cx: x + TILE_W / 2, cy: y + TILE_H / 2 };
}

function renderSvg(result: WorldMapMvpResult): string {
  const parts: string[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const track = (coord: IHexCoordinates) => {
    const { x, y } = calcHexPixelPosition({ coordinates: coord }, TILE_W, TILE_H);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + TILE_W);
    maxY = Math.max(maxY, y + TILE_H);
  };

  const promiseCells = result.promises.map((p) => ({
    coord: getOddQNeighbors(p.seam.coord)[p.seam.dir],
    strength: p.strength,
    type: p.type,
  }));
  const openSeamCells = result.openSeams.map((s) => getOddQNeighbors(s.coord)[s.dir]);

  for (const tile of result.map.tiles) track(tile.coordinates);
  for (const cell of promiseCells) track(cell.coord);
  for (const cell of openSeamCells) track(cell);

  for (const cell of openSeamCells) {
    const { x, y } = calcHexPixelPosition({ coordinates: cell }, TILE_W, TILE_H);
    parts.push(
      `<polygon points="${hexPoints(x, y)}" fill="none" stroke="#5b6470" stroke-width="1" stroke-dasharray="3 3" opacity="0.5" />`,
    );
  }

  for (const cell of promiseCells) {
    const { cx, cy } = centreOf(cell.coord);
    parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(TILE_W * 0.42).toFixed(1)}" fill="${PROMISE_FILL[cell.strength]}" />`,
    );
    parts.push(
      `<text x="${cx.toFixed(1)}" y="${(cy + TILE_H * 0.62).toFixed(1)}" text-anchor="middle" font-size="7" fill="#9ec3e4" opacity="0.75">${cell.strength} ${cell.type}</text>`,
    );
  }

  for (const tile of result.map.tiles) {
    const terrain = result.terrainByCoord[coordinateKey(tile.coordinates)] ?? 'OPEN_GROUND';
    const { x, y } = calcHexPixelPosition({ coordinates: tile.coordinates }, TILE_W, TILE_H);
    parts.push(
      `<polygon points="${hexPoints(x, y)}" fill="${TERRAIN_FILL[terrain]}" stroke="#1b1d22" stroke-width="1" />`,
    );
  }

  for (const anchor of result.anchors) {
    const { cx, cy } = centreOf(anchor.coord);
    parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="none" stroke="#e0c26a" stroke-width="1.5" />`,
    );
    parts.push(
      `<text x="${cx.toFixed(1)}" y="${(cy - TILE_H * 0.32).toFixed(1)}" text-anchor="middle" font-size="6" fill="#e0c26a">${anchor.kind.replace('_SLOT', '')}</text>`,
    );
  }

  const camp = centreOf(result.campAnchor);
  parts.push(
    `<circle cx="${camp.cx.toFixed(1)}" cy="${camp.cy.toFixed(1)}" r="${(TILE_W * 0.3).toFixed(1)}" fill="none" stroke="#f2d675" stroke-width="3" />`,
  );

  const hero = centreOf(result.heroSpawn);
  parts.push(
    `<circle cx="${hero.cx.toFixed(1)}" cy="${hero.cy.toFixed(1)}" r="6" fill="#7ad17a" stroke="#0b0d11" stroke-width="1.5" />`,
  );

  const w = maxX - minX + PAD * 2;
  const h = maxY - minY + PAD * 2;
  const vb = `${(minX - PAD).toFixed(1)} ${(minY - PAD).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w.toFixed(0)}" height="${h.toFixed(0)}">`,
    `<rect x="${(minX - PAD).toFixed(1)}" y="${(minY - PAD).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#0b0d11" />`,
    ...parts,
    `</svg>`,
    '',
  ].join('\n');
}

function findAccepted(archetype: TWorldArchetypeKey, slot: number): WorldMapMvpResult {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const result = generateWorldMap({
      seed: `worldmap-sample:${archetype}:${slot}:${attempt}`,
      archetype,
    });
    if (result.validation.accepted) return result;
  }
  throw new Error(`no accepted ${archetype} sample for slot ${slot}`);
}

const run = process.env.GEN_SAMPLES === '1' ? describe : describe.skip;

run('world map MVP sample set', () => {
  it('writes 10 accepted maps with metrics to docs/design/samples/world-map-mvp', () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const metrics: Record<string, unknown>[] = [];

    for (const { archetype, count } of PLAN) {
      for (let slot = 1; slot <= count; slot += 1) {
        const result = findAccepted(archetype, slot);
        const file = `${archetype.toLowerCase().replace(/_/g, '-')}-${String(slot).padStart(2, '0')}.svg`;
        writeFileSync(join(OUT_DIR, file), renderSvg(result), 'utf8');

        const m = result.validation.metrics;
        metrics.push({
          file,
          seed: result.seed,
          archetype: result.archetype,
          accepted: result.validation.accepted,
          score: result.validation.score,
          rejectedAttempts: result.attempts - 1,
          hexCount: m.hexCount,
          branchCount: m.branchCount,
          chokepointCount: m.chokepointCount,
          openAreaSize: m.openAreaSize,
          pocketSize: m.pocketSize,
          promiseCount: m.promiseCount,
          routeLoops: m.routeLoops,
          meanNeighbours: Number(m.meanNeighbours.toFixed(2)),
          thinSharePct: Math.round(m.thinShare * 100),
          articulationSharePct: Math.round(m.articulationShare * 100),
          promises: result.promises.map((p) => ({ type: p.type, strength: p.strength })),
          anchorKinds: result.anchors.map((a) => a.kind),
          rejectionReasons: result.validation.rejectionReasons,
        });
        expect(result.validation.accepted).toBe(true);
      }
    }

    writeFileSync(join(OUT_DIR, 'samples.json'), `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
    expect(metrics).toHaveLength(10);
  });
});
