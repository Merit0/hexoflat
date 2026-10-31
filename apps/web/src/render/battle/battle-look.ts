import type { BattleTerrain } from '@hexoflat/engine/battle/battle-state';
import { CONTENT } from '@hexoflat/engine/content/content-map';
import { BATTLEFIELD_BIOMES, type BattlefieldBiome } from '@hexoflat/engine/battle/battlefield';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';

const BATTLE_TOKEN_DIR = '/hex-assets/battle-tokens';

export const BATTLE_TERRAIN_TOKENS: Partial<Record<BattleTerrain, string>> = {
  rubble: `${BATTLE_TOKEN_DIR}/rubble-token.svg`,
  ledge: `${BATTLE_TOKEN_DIR}/ledge-token.svg`,
  oil: `${BATTLE_TOKEN_DIR}/oil-token.svg`,
  saw: `${BATTLE_TOKEN_DIR}/saw-token.svg`,
};

export function battleFloorSprite(biome: BattlefieldBiome): string {
  return BATTLEFIELD_BIOMES[biome].background;
}

export function battleObjectSprite(key: 'wall' | 'boulder'): string {
  const hexobjectKey = key === 'wall' ? HEXOBJECT_KEYS.STONE_WALL : HEXOBJECT_KEYS.ROCK;
  return CONTENT[hexobjectKey]?.spritePath ?? '';
}

export function battleShieldSprite(): string {
  return CONTENT[HEXOBJECT_KEYS.SHIELD]?.spritePath ?? '';
}

export const BATTLE_OVERLAY_COLORS = {
  heroZone: { fill: 0x1a2a3c, stroke: 0x4a8be0 },
  enemyZone: { fill: 0x2a161c, stroke: 0xb0306a },
  ring: { fill: 0x4a1e1b, stroke: 0xc2412d },
  target: { fill: 0xe0a93f, stroke: 0xe0a93f },
  shield: { fill: 0x8fb4d9, stroke: 0xdbe8f5 },
  blocked: { fill: 0x2f8f4e, stroke: 0x4fd07a },
  hit: { fill: 0x8c2a22, stroke: 0xe0503c },
  dodged: { fill: 0x3a4a5c, stroke: 0x8aa0b8 },
} as const;

export const BATTLE_SWORD_COLORS = { blade: 0xe8eef6, guard: 0xe0a93f, grip: 0x6b4a2a } as const;

export type BattleOverlayTone = keyof typeof BATTLE_OVERLAY_COLORS;

export const SAW_SPIN_RADIANS_PER_SECOND = Math.PI * 2;

export const BATTLE_LEGEND_ITEMS = ['rubble', 'ledge', 'oil', 'saw', 'boulder'] as const;
