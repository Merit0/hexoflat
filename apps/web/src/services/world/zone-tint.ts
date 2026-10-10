import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { BOARD_LAYOUTS } from '@hexoflat/engine/content/boards/index';
import type { BoardDescriptor } from '@hexoflat/engine/boards/board-descriptors';

export const ZONE_TINT_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xa78bfa, 0xf38181];

export interface ZoneLegendEntry {
  zoneId: string;
  chunkId: string;
  color: number;
}

function findLayout(descriptor: BoardDescriptor | null) {
  if (!descriptor || descriptor.kind !== 'DUNGEON') return null;
  return BOARD_LAYOUTS.find((layout) => layout.id === descriptor.layoutId) ?? null;
}

/** Dev board panel's zone-outline toggle: one tint per layout zone, so each authored area reads as a distinct block on the board. */
export function computeZoneTints(descriptor: BoardDescriptor | null): Map<string, number> {
  const tints = new Map<string, number>();
  const layout = findLayout(descriptor);
  if (!layout) return tints;

  layout.zones.forEach((zone, index) => {
    const color = ZONE_TINT_COLORS[index % ZONE_TINT_COLORS.length];
    for (let row = zone.row; row < zone.row + zone.height; row += 1) {
      for (let column = zone.col; column < zone.col + zone.width; column += 1) {
        tints.set(coordinateKey({ columnIndex: column, rowIndex: row }), color);
      }
    }
  });

  return tints;
}

/** Legend for the zone-outline toggle: each zone's tint color next to the chunk id it actually built with. */
export function computeZoneLegend(descriptor: BoardDescriptor | null): ZoneLegendEntry[] {
  const layout = findLayout(descriptor);
  if (!layout || descriptor?.kind !== 'DUNGEON') return [];

  return layout.zones.map((zone, index) => ({
    zoneId: zone.id,
    chunkId: descriptor.chunkByZone[zone.id] ?? '?',
    color: ZONE_TINT_COLORS[index % ZONE_TINT_COLORS.length],
  }));
}
