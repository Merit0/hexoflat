import type { BattleTerrain } from '@hexoflat/engine/battle/battle-state';
import { CONTENT } from '@hexoflat/engine/content/content-map';
import { BATTLEFIELD_BIOMES, type BattlefieldBiome } from '@hexoflat/engine/battle/battlefield';
import { CREATURE_SPRITES } from '@/render/creature-sprites';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';

const BATTLE_TOKEN_DIR = '/hex-assets/battle-tokens';

export const BATTLE_TERRAIN_TOKENS: Partial<Record<BattleTerrain, string>> = {
  rubble: `${BATTLE_TOKEN_DIR}/rubble-token.svg`,
  ledge: `${BATTLE_TOKEN_DIR}/ledge-token.svg`,
  oil: `${BATTLE_TOKEN_DIR}/oil-token.svg`,
  saw: '/hex-assets/hex-constructs/saw-token.png',
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

export function battleAssetPaths(biome: BattlefieldBiome): string[] {
  return [
    battleFloorSprite(biome),
    battleObjectSprite('wall'),
    battleObjectSprite('boulder'),
    battleShieldSprite(),
    ...Object.values(BATTLE_TERRAIN_TOKENS),
    ...Object.values(CREATURE_SPRITES),
  ].filter(Boolean);
}

export type BattleOverlayTone =
  | 'heroZone'
  | 'enemyZone'
  | 'ring'
  | 'target'
  | 'selected'
  | 'shield'
  | 'blocked'
  | 'hit'
  | 'dodged';

export const BATTLE_SELECTED_COLOR = 0xe03a32;

export const SAW_SPIN_RADIANS_PER_SECOND = Math.PI * 2;

export const BATTLE_LEGEND_ITEMS = ['saw'] as const;
