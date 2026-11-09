export const BAG_GRID = {
  cols: 12,
  rows: 7,
  blockedRect: { x: 3, y: 1, w: 6, h: 5 },
} as const;

export const BAG_WILL_SLOT_KEY = 'r0c0';

export const DEFAULT_CARRY_CAPACITY_KG = 10;

function buildBagSlotKeys(): readonly string[] {
  const { x, y, w, h } = BAG_GRID.blockedRect;
  const keys: string[] = [];
  for (let row = 0; row < BAG_GRID.rows; row += 1) {
    for (let col = 0; col < BAG_GRID.cols; col += 1) {
      const blocked = col >= x && col < x + w && row >= y && row < y + h;
      const key = `r${row}c${col}`;
      if (!blocked && key !== BAG_WILL_SLOT_KEY) keys.push(key);
    }
  }
  return keys;
}

export const BAG_SLOT_KEYS: readonly string[] = buildBagSlotKeys();
export const BAG_CAPACITY = BAG_SLOT_KEYS.length;

export function bagIndexOfSlotKey(slotKey: string): number {
  return BAG_SLOT_KEYS.indexOf(slotKey);
}
