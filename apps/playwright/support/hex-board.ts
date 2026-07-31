import type { Locator, Page } from '@playwright/test';

/**
 * The 'camping' map is generated as a fixed WIDTH x HEIGHT rectangle
 * (packages/engine/src/generators/world-generator.ts `buildBaseGrid`) with a
 * deterministic tile layout (packages/engine's `campingMapConfig`) — no RNG,
 * no fog (fogPolicy: 'ALL_REVEALED'). That's what makes it safe to drive
 * from a Playwright test without importing the engine package at all: the
 * grid dimensions below are all the geometry needs, and the coordinates of
 * fixed objects (spawn gate, starter tools) are copied from
 * packages/engine/src/map/providers/map-tiles-schema-provider.ts.
 */
export const CAMPING_GRID = { width: 10, height: 6 };

/** A starter AXE (TOOL, pickable by hand) sitting in the safe camping zone. */
export const CAMPING_AXE = { columnIndex: 7, rowIndex: 2 };

export interface HexCoordinates {
  columnIndex: number;
  rowIndex: number;
}

const STORAGE_INDEX_KEY = 'hexoflat:world:index:v1';
const STORAGE_STATE_PREFIX = 'hexoflat:world:state:v1:';
const STORAGE_MAP_PREFIX = 'hexoflat:world:map:v1:';

/** Mirrors calcHexPixelPosition in packages/engine/src/utils/hex-utils.ts. */
function tilePixel(coord: HexCoordinates, tileW: number, tileH: number) {
  const q = coord.columnIndex;
  const r = coord.rowIndex;
  return { x: tileW * 0.75 * q, y: tileH * (r + (q % 2 ? 0.5 : 0)) };
}

/** Mirrors getOddQNeighbors in packages/engine/src/utils/hex-utils.ts. */
export function neighborsOf(coord: HexCoordinates): HexCoordinates[] {
  const q = coord.columnIndex;
  const r = coord.rowIndex - (q - (q & 1)) / 2;
  const dirs = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  return dirs.map((d) => {
    const columnIndex = q + d.q;
    const rowIndex = r + d.r + (columnIndex - (columnIndex & 1)) / 2;
    return { columnIndex, rowIndex };
  });
}

/** Mirrors hexDistance in packages/engine/src/utils/hex-utils.ts. */
export function hexDistance(a: HexCoordinates, b: HexCoordinates): number {
  const toAxial = (c: HexCoordinates) => ({
    q: c.columnIndex,
    r: c.rowIndex - (c.columnIndex - (c.columnIndex & 1)) / 2,
  });
  const ax = toAxial(a);
  const bx = toAxial(b);
  const dq = ax.q - bx.q;
  const dr = ax.r - bx.r;
  const ds = -ax.q - ax.r - (-bx.q - bx.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

function coordKey(c: HexCoordinates): string {
  return `${c.columnIndex}:${c.rowIndex}`;
}

/**
 * Fraction (0..1) of a tile's center within the map's full bounding box, in
 * the same coordinate system apps/web computes in hex-world-map.vue's
 * `mapBounds`. The tile size used here (1000px) is arbitrary — every term in
 * `tilePixel`/`mapBounds` scales linearly with it except the small fixed
 * `bleed`, so the resulting fraction is (to a ~0.05% error) independent of
 * the value chosen. That means this never has to match the page's actual
 * live CSS tile size to line up with real on-screen positions.
 */
function tileCenterFraction(coord: HexCoordinates) {
  const tileW = 1000;
  const tileH = 1000;
  const bleed = 2;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let q = 0; q < CAMPING_GRID.width; q++) {
    for (let r = 0; r < CAMPING_GRID.height; r++) {
      const { x, y } = tilePixel({ columnIndex: q, rowIndex: r }, tileW, tileH);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + tileW);
      maxY = Math.max(maxY, y + tileH);
    }
  }

  const mapWidth = maxX - minX + bleed * 2;
  const mapHeight = maxY - minY + bleed * 2;
  const offsetX = minX - bleed;
  const offsetY = minY - bleed;

  const { x, y } = tilePixel(coord, tileW, tileH);
  return {
    fx: (x + tileW / 2 - offsetX) / mapWidth,
    fy: (y + tileH / 2 - offsetY) / mapHeight,
  };
}

function boardCanvas(page: Page): Locator {
  return page.getByTestId('hex-board-canvas');
}

/** Position (relative to the canvas element's own box) of a tile's center. */
async function tileBoxPosition(page: Page, coord: HexCoordinates) {
  const canvas = boardCanvas(page);
  const box = await canvas.boundingBox();
  if (!box) throw new Error('hex-board-canvas has no bounding box — is the map rendered?');

  const { fx, fy } = tileCenterFraction(coord);
  return { x: fx * box.width, y: fy * box.height };
}

export async function clickTile(page: Page, coord: HexCoordinates): Promise<void> {
  const position = await tileBoxPosition(page, coord);
  await boardCanvas(page).click({ position });
}

export async function hoverTile(page: Page, coord: HexCoordinates): Promise<void> {
  const position = await tileBoxPosition(page, coord);
  await boardCanvas(page).hover({ position });
}

/** Arms the hero's default HAND tool (both equip slots default to it for a fresh hero). */
export async function armHandTool(page: Page): Promise<void> {
  await boardCanvas(page).hover();
  await page.mouse.wheel(0, 100);
}

const INVENTORY_STORAGE_KEY = 'hexoflat.hero.inventory.v1';

/**
 * Reads the persisted inventory directly out of localStorage (see
 * hero-inventory-store.ts's `persist`/`INVENTORY_STORAGE_KEY`) instead of
 * opening the in-game inventory overlay. Opening that overlay requires
 * clicking the hero's own tile — a separate interactive Pixi layer stacked
 * exactly on top of the tile grid (render/layers/hero-layer.ts) — which,
 * unlike every other tile click this file does, could not be made to
 * register reliably through Playwright's synthesized pointer events. Reading
 * the same state the overlay would display sidesteps that without weakening
 * the assertion.
 */
export async function getInventoryItemKeys(page: Page): Promise<string[]> {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { items?: Array<{ key: string }> };
    return (parsed.items ?? []).map((item) => item.key);
  }, INVENTORY_STORAGE_KEY);
}

async function readCampingMapId(page: Page): Promise<string> {
  const mapId = await page.evaluate((indexKey) => {
    const raw = localStorage.getItem(indexKey);
    if (!raw) return null;
    const index = JSON.parse(raw) as Partial<Record<string, string>>;
    return index.camping ?? null;
  }, STORAGE_INDEX_KEY);

  if (!mapId) throw new Error('No camping map id in localStorage yet — has the map loaded?');
  return mapId;
}

export async function getHeroCoordinates(page: Page): Promise<HexCoordinates> {
  const mapId = await readCampingMapId(page);
  const coords = await page.evaluate(
    ({ statePrefix, mapId }) => {
      const raw = localStorage.getItem(statePrefix + mapId);
      if (!raw) return null;
      const state = JSON.parse(raw) as { heroCoordinates: HexCoordinates | null };
      return state.heroCoordinates;
    },
    { statePrefix: STORAGE_STATE_PREFIX, mapId },
  );

  if (!coords) throw new Error('Hero has no coordinates yet on the camping map.');
  return coords;
}

/**
 * Reads the hexobject key sitting on a given tile directly out of the
 * persisted map (`hexoflat:world:map:v1:<mapId>` — see world-map-store.ts's
 * `saveToStorage`), so a test can confirm an object was actually removed
 * from the map itself, not just added to the inventory. A finished TAKE
 * action sets `tile.hexobject = null` for non-RESOURCE items (no respawn) —
 * see `consumeTileHexobject` in action-finishers-registry.ts.
 */
export async function getTileHexobjectKey(
  page: Page,
  coord: HexCoordinates,
): Promise<string | null> {
  const mapId = await readCampingMapId(page);
  return page.evaluate(
    ({ mapPrefix, mapId, coord }) => {
      const raw = localStorage.getItem(mapPrefix + mapId);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        map?: {
          tiles?: Array<{
            coordinates: HexCoordinates;
            hexobject?: { hexobjectKey: string } | null;
          }>;
        };
      };
      const tile = parsed.map?.tiles?.find(
        (t) =>
          t.coordinates.columnIndex === coord.columnIndex &&
          t.coordinates.rowIndex === coord.rowIndex,
      );
      return tile?.hexobject?.hexobjectKey ?? null;
    },
    { mapPrefix: STORAGE_MAP_PREFIX, mapId, coord },
  );
}

async function waitForHeroCoordinates(
  page: Page,
  predicate: (coord: HexCoordinates) => boolean,
  timeoutMs: number,
): Promise<HexCoordinates> {
  const start = Date.now();
  for (;;) {
    const coord = await getHeroCoordinates(page).catch(() => null);
    if (coord && predicate(coord)) return coord;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for hero coordinates to match.`);
    }
    await page.waitForTimeout(100);
  }
}

/**
 * Clicking a candidate neighbor that turns out to hold an object (a tool,
 * the fireplace, ...) doesn't move the hero — it opens the hex-tile-details
 * overlay instead (use-tile-click.ts). That overlay's backdrop then covers
 * the whole board and silently swallows every later canvas click, so a
 * movement helper trying several candidate directions must close it before
 * moving on to the next one.
 */
async function closeStrayTileDetailsOverlay(page: Page): Promise<void> {
  const closeButton = page.getByTestId('tile-details-close-button');
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await closeButton.waitFor({ state: 'hidden' });
  }
}

/** Clicks one adjacent, currently-empty tile and waits for the hero to actually step onto it. */
export async function moveHeroOneStep(page: Page): Promise<HexCoordinates> {
  const from = await getHeroCoordinates(page);
  const candidates = neighborsOf(from);

  for (const candidate of candidates) {
    await clickTile(page, candidate);
    await closeStrayTileDetailsOverlay(page);
    try {
      return await waitForHeroCoordinates(
        page,
        (coord) => coordKey(coord) !== coordKey(from),
        1_500,
      );
    } catch {
      // This neighbor was solid/occupied/out of bounds — try the next direction.
    }
  }

  throw new Error(
    `Hero at (${from.columnIndex}, ${from.rowIndex}) could not step onto any of its 6 neighbors.`,
  );
}

/**
 * Walks the hero, one hex per click (a fresh hero's scout rank only grants 1
 * move step — packages/engine/src/hero-movement/scout-progression.ts), until
 * it is standing next to `target`. Direction is chosen greedily by hex
 * distance; if a chosen neighbor turns out to be blocked, the next-best
 * neighbor is tried instead, so this doesn't need to know the map's full
 * collision layout up front.
 */
export async function moveHeroAdjacentTo(
  page: Page,
  target: HexCoordinates,
  maxSteps = 20,
): Promise<void> {
  for (let step = 0; step < maxSteps; step++) {
    const from = await getHeroCoordinates(page);
    if (hexDistance(from, target) <= 1) return;

    const ranked = neighborsOf(from)
      .filter((c) => hexDistance(c, target) < hexDistance(from, target))
      .sort((a, b) => hexDistance(a, target) - hexDistance(b, target));

    let moved = false;
    for (const candidate of ranked) {
      await clickTile(page, candidate);
      await closeStrayTileDetailsOverlay(page);
      try {
        await waitForHeroCoordinates(
          page,
          (coord) => coordKey(coord) === coordKey(candidate),
          1_500,
        );
        moved = true;
        break;
      } catch {
        // Blocked — try the next-best direction toward the target.
      }
    }

    if (!moved) {
      throw new Error(
        `Stuck at (${from.columnIndex}, ${from.rowIndex}) — no forward neighbor toward ` +
          `(${target.columnIndex}, ${target.rowIndex}) was walkable.`,
      );
    }
  }

  throw new Error(`Did not reach a tile adjacent to target within ${maxSteps} steps.`);
}
