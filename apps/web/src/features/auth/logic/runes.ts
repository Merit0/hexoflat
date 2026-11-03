export const RUNE_IDS = ['star', 'moon', 'leaf', 'flame', 'drop', 'bolt', 'sun'] as const;

export type RuneId = (typeof RUNE_IDS)[number];

export const RUNE_PATHS: Record<RuneId, string> = {
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  leaf: 'M5 19C5 10 11 5 20 4c-1 9-6 15-15 15zM5 19l7-7',
  flame: 'M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z',
  drop: 'M12 3l6 8a7 7 0 1 1-12 0z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
};

export const RUNE_POSITIONS: Record<RuneId, readonly [number, number]> = {
  star: [78, 72],
  moon: [137, 38],
  leaf: [137, 106],
  flame: [78, 140],
  drop: [19, 106],
  bolt: [19, 38],
  sun: [78, 4],
};

export const RUNE_CODE_LENGTH = 4;

export interface RunePickResult {
  runes: RuneId[];
  complete: boolean;
}

export function resetRunes(): RuneId[] {
  return [];
}

export function pickRune(current: readonly RuneId[], id: RuneId): RunePickResult {
  if (current.includes(id) || current.length >= RUNE_CODE_LENGTH) {
    return { runes: [...current], complete: false };
  }
  const runes = [...current, id];
  return { runes, complete: runes.length === RUNE_CODE_LENGTH };
}

export function runePolyline(picked: readonly RuneId[]): string {
  return picked
    .map((id) => {
      const [x, y] = RUNE_POSITIONS[id];
      return `${x + 34},${y + 36}`;
    })
    .join(' ');
}
