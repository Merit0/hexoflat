import type { Threat } from '@hexoflat/engine/encounters/threat';

export type EncounterRim = Threat | 'loot';

export const ENCOUNTER_RIMS: Record<EncounterRim, { light: string; dark: string }> = {
  easy: { light: '#A8C98E', dark: '#4E6B3E' },
  risky: { light: '#F0C060', dark: '#8C5A12' },
  deadly: { light: '#F07A6A', dark: '#7A1A12' },
  loot: { light: '#E8D7A8', dark: '#6E5A2E' },
};

export const ENCOUNTER_MARKS = {
  unknown: { fill: '#2A0E18', stroke: '#B0306A' },
  sentry: { fill: '#5A1A14', stroke: '#FF8A7A' },
  watched: { fill: '#2A1719', stroke: '#7A2A24' },
  glow: '#FFD36B',
};

export const ENCOUNTER_TOKEN_URL = '/enemy-assets/boss-hex-images/skeletor-token-image.png';
export const ENCOUNTER_LOOT_URL = '/hex-assets/hex-loot/chest-token.png';

const LEADER_GLYPHS: Record<string, string> = {
  'skeleton-king': '👑',
  'skeleton-archer': '🏹',
};

export function leaderGlyph(kind: string): string {
  return LEADER_GLYPHS[kind] ?? '';
}

export function rimOf(view: { status: string; threat: Threat }): EncounterRim {
  return view.status === 'loot' ? 'loot' : view.threat;
}

export function toPixiColor(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}
