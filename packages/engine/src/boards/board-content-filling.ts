import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { BoardLayout, GeneratedBoardPreset } from '../content/boards/schemas';
import type { SeededRandom } from '../utils/random-seeded';
import type { BoardCellMap } from './board-cell-map';
import type { ZonePlacement } from './zone-placement';

export function placeEntryObject(
  layout: BoardLayout,
  placementByZoneId: Map<string, ZonePlacement>,
  entryObjectKey: THexobjectKey,
  cellMap: BoardCellMap,
): void {
  const entryCell = placementByZoneId.get(layout.entryZone)?.entryCells[0];
  if (!entryCell) throw new Error(`entry zone "${layout.entryZone}" has no entry slot cell`);
  cellMap.set(entryCell, { exists: true, hexobject: { hexobjectKey: entryObjectKey } });
}

function shuffledSample(
  cells: IHexCoordinates[],
  count: number,
  rng: SeededRandom,
): IHexCoordinates[] {
  const copy = [...cells];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

function pickCount(min: number, max: number, rng: SeededRandom): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function maxZoneDepth(layout: BoardLayout): number {
  return Math.max(...Object.values(layout.depth));
}

/** Resource/enemy slots (§3.4 step 8): a single hexobjectKey filled into a random subset of the collected slot cells, sized between the rule's min and max. */
function fillSingleKeySlot(
  cells: IHexCoordinates[],
  hexobjectKey: THexobjectKey,
  min: number,
  max: number,
  rng: SeededRandom,
  cellMap: BoardCellMap,
): void {
  const chosen = shuffledSample(cells, pickCount(min, max, rng), rng);
  for (const coord of chosen) cellMap.set(coord, { exists: true, hexobject: { hexobjectKey } });
}

/** POI slots pick one of several possible hexobjectKeys per filled cell. */
function fillPoiSlot(
  cells: IHexCoordinates[],
  hexobjectKeys: THexobjectKey[],
  min: number,
  max: number,
  rng: SeededRandom,
  cellMap: BoardCellMap,
): void {
  const chosen = shuffledSample(cells, pickCount(min, max, rng), rng);
  for (const coord of chosen) {
    const hexobjectKey = hexobjectKeys[Math.floor(rng() * hexobjectKeys.length)];
    cellMap.set(coord, { exists: true, hexobject: { hexobjectKey } });
  }
}

export function fillSlots(
  layout: BoardLayout,
  placements: ZonePlacement[],
  preset: GeneratedBoardPreset,
  cellMap: BoardCellMap,
  rng: SeededRandom,
): void {
  const resourceCells = placements.flatMap((p) => p.resourceSlotCells);
  const poiCells = placements.flatMap((p) => p.poiSlotCells);

  const maxDepth = maxZoneDepth(layout);
  const enemyCells = placements
    .filter((p) => layout.depth[p.zoneId] === maxDepth)
    .flatMap((p) => p.enemySlotCells);

  fillSingleKeySlot(
    resourceCells,
    preset.slots.resource.hexobjectKey,
    preset.slots.resource.min,
    preset.slots.resource.max,
    rng,
    cellMap,
  );
  fillPoiSlot(
    poiCells,
    preset.slots.poi.hexobjectKeys,
    preset.slots.poi.min,
    preset.slots.poi.max,
    rng,
    cellMap,
  );
  fillSingleKeySlot(
    enemyCells,
    preset.slots.enemy.hexobjectKey,
    preset.slots.enemy.min,
    preset.slots.enemy.max,
    rng,
    cellMap,
  );
}
