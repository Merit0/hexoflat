export type GridNavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

const NAV_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

export function isGridNavKey(key: string): key is GridNavKey {
  return NAV_KEYS.has(key);
}

/** Where focus goes from `current` in a grid read row by row, or `null` when the edge stops it. */
export function nextCellIndex(
  current: number,
  key: GridNavKey,
  columns: number,
  count: number,
): number | null {
  if (key === 'Home') return count > 0 ? 0 : null;
  if (key === 'End') return count > 0 ? count - 1 : null;
  const column = current % columns;
  const target = {
    ArrowLeft: column > 0 ? current - 1 : -1,
    ArrowRight: column < columns - 1 ? current + 1 : -1,
    ArrowUp: current - columns,
    ArrowDown: current + columns,
  }[key];
  return target >= 0 && target < count && target !== current ? target : null;
}

export function moveGridFocus(event: KeyboardEvent, cellSelector: string): void {
  if (!isGridNavKey(event.key)) return;
  const current = event.currentTarget as HTMLElement;
  const grid = current.closest<HTMLElement>('[data-cell-grid]');
  if (!grid) return;
  const cells = [...grid.querySelectorAll<HTMLElement>(cellSelector)];
  const columns = Number(grid.dataset.columns) || 1;
  const target = nextCellIndex(cells.indexOf(current), event.key, columns, cells.length);
  event.preventDefault();
  if (target !== null) cells[target].focus();
}
