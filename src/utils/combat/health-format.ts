export function roundToSingleDecimal(value: number): number {
  return Number(value.toFixed(1));
}

export function normalizeHealthValue(value: number, min = 0): number {
  return Math.max(min, roundToSingleDecimal(value));
}
