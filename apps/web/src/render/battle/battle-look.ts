import type { BattleTerrain } from '@hexoflat/engine/battle/battle-state';

export const BATTLE_SPRITES = {
  stoneFloor: '/hex-assets/board-hexes/stone-hex.png',
  rock: '/hex-assets/hex-resources/rock-token-image.png',
  skeleton: '/hero-asssets/skeleton-hex.png',
  hero: '/hero-asssets/human-hex.png',
} as const;

export interface TerrainPaint {
  fill: number;
  stroke: number;
  label: string | null;
}

export const BATTLE_TERRAIN_PAINT: Record<BattleTerrain, TerrainPaint> = {
  floor: { fill: 0x1b1a1f, stroke: 0x2e2c34, label: null },
  wall: { fill: 0x3a3a40, stroke: 0x55555c, label: null },
  rubble: { fill: 0x2a2620, stroke: 0x4a4236, label: null },
  ledge: { fill: 0x45434c, stroke: 0x6c6976, label: 'LEDGE' },
  oil: { fill: 0x2c1838, stroke: 0x6b3a8c, label: 'OIL' },
  saw: { fill: 0x2a1a1a, stroke: 0x8c3a2e, label: null },
};

export const BATTLE_OVERLAY_COLORS = {
  heroZone: { fill: 0x1a2a3c, stroke: 0x4a8be0 },
  enemyZone: { fill: 0x2a161c, stroke: 0xb0306a },
  reachable: { fill: 0x4a8be0, stroke: 0x4a8be0 },
  danger: { fill: 0xc2412d, stroke: 0xc2412d },
  ring: { fill: 0x4a1e1b, stroke: 0xc2412d },
  target: { fill: 0xe0a93f, stroke: 0xe0a93f },
  shield: { fill: 0x8fb4d9, stroke: 0xdbe8f5 },
  blocked: { fill: 0x2f8f4e, stroke: 0x4fd07a },
  hit: { fill: 0x8c2a22, stroke: 0xe0503c },
  dodged: { fill: 0x3a4a5c, stroke: 0x8aa0b8 },
} as const;

export type BattleOverlayTone = keyof typeof BATTLE_OVERLAY_COLORS;

export const SAW_SPIN_RADIANS_PER_SECOND = Math.PI * 2;

export const BATTLE_LEGEND_ITEMS = ['rubble', 'ledge', 'oil', 'saw', 'boulder'] as const;
