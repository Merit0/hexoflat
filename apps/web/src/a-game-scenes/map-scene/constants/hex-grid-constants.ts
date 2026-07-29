/**
 * Shared hex-grid sizing constants.
 *
 * GRID_COLUMNS defines how many hex tiles fit across the viewport width;
 * tile pixel width is derived from it. Keeping this in one place avoids
 * hex-world-map.vue and hex-tile.vue silently drifting out of sync.
 */
export const GRID_COLUMNS = 42;

export function getTileWidth(viewportWidth: number = window.innerWidth): number {
  return viewportWidth / GRID_COLUMNS;
}
