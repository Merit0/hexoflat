/** Whitespace is layout only (odd rows carry one leading space to visually stagger like the odd-r grid) — cells are whitespace-separated tokens. */
export function parseBoardRow(row: string): string[] {
  const trimmed = row.trim();
  return trimmed.length ? trimmed.split(/\s+/) : [];
}

export function parseBoardRows(rows: string[]): string[][] {
  return rows.map(parseBoardRow);
}

export function boardRowsAreRectangular(rows: string[][]): boolean {
  if (rows.length === 0) return true;
  const width = rows[0].length;
  return rows.every((row) => row.length === width);
}
