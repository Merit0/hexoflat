import type { IHexCoordinates } from '../../map/interfaces/hex-tile-config-interface';
import { parseBoardRows } from '../../boards/board-rows';
import { coordinateKey, getHexNeighbors } from '../../utils/hex-utils';
import { CAMPING_BOARD } from './static/camping';

export interface CampPlace {
  locationKey: string;
  coordinates: IHexCoordinates;
}

const spotsByKey = new Map<string, readonly IHexCoordinates[]>();

export function campObjectSpots(hexobjectKey: string): readonly IHexCoordinates[] {
  const known = spotsByKey.get(hexobjectKey);
  if (known) return known;
  const legend: Record<string, { hexobjectKey: string }> = CAMPING_BOARD.legend;
  const symbols = new Set(
    Object.entries(legend)
      .filter(([, entry]) => entry.hexobjectKey === hexobjectKey)
      .map(([symbol]) => symbol),
  );
  const spots = parseBoardRows(CAMPING_BOARD.rows).flatMap((row, rowIndex) =>
    row.flatMap((symbol, columnIndex) => (symbols.has(symbol) ? [{ columnIndex, rowIndex }] : [])),
  );
  spotsByKey.set(hexobjectKey, spots);
  return spots;
}

export function standsNextToCampObject(place: CampPlace | null, hexobjectKey: string): boolean {
  if (!place || place.locationKey !== CAMPING_BOARD.id) return false;
  const spots = new Set(campObjectSpots(hexobjectKey).map(coordinateKey));
  return getHexNeighbors(place.coordinates).some((hex) => spots.has(coordinateKey(hex)));
}
