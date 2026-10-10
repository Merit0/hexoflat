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

export function formatBoardRow(cells: string[], rowIndex: number): string {
  const joined = cells.join(' ');
  return rowIndex % 2 === 1 ? ` ${joined}` : joined;
}
