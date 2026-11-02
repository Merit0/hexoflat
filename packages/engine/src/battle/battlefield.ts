import { battlefieldCenter } from '../boards/pipeline/pieces/battlefield';
import { runBoardPipeline, type PipelineBoard } from '../boards/pipeline/run-board-pipeline';
import { BATTLEFIELD_CRYPT_MODEL } from '../content/boards/models/battlefield-crypt';
import type { BoardRecipeInput } from '../content/boards/recipe-schema';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { axialToOffset, offsetToAxial } from '../utils/hex-utils';
import type { BattleHex, BattleTerrain, Boulder } from './battle-state';
import { hexKey } from './hex-battle-geom';

export const BATTLEFIELD_BIOMES = { crypt: BATTLEFIELD_CRYPT_MODEL } as const;
export type BattlefieldBiome = keyof typeof BATTLEFIELD_BIOMES;

export interface Battlefield {
  seed: string;
  biome: BattlefieldBiome;
  board: Record<string, BattleTerrain>;
  boulders: Boulder[];
}

const BATTLE_TERRAIN_OF: Partial<Record<string, BattleTerrain>> = {
  rubble: 'rubble',
  ledge: 'ledge',
  oil: 'oil',
  saw: 'saw',
};

export function battlefieldSeed(squadId: string, attempt: number): string {
  return `${squadId}:battlefield:${attempt}`;
}

function frameOf(model: BoardRecipeInput) {
  return { frame: model.frame };
}

export function battleHexToOffset(biome: BattlefieldBiome, hex: BattleHex) {
  const center = offsetToAxial(battlefieldCenter(frameOf(BATTLEFIELD_BIOMES[biome])));
  return axialToOffset({ q: hex.q + center.q, r: hex.r + center.r });
}

export function battlefieldFromPipeline(
  pipeline: PipelineBoard,
  biome: BattlefieldBiome,
  seed: string,
): Battlefield {
  const center = offsetToAxial(battlefieldCenter(frameOf(BATTLEFIELD_BIOMES[biome])));
  const board: Record<string, BattleTerrain> = {};
  const boulders: Boulder[] = [];
  for (const tile of pipeline.map.tiles) {
    const axial = offsetToAxial(tile.coordinates);
    const hex = { q: axial.q - center.q, r: axial.r - center.r };
    const objectKey = tile.hexobject?.hexobjectKey;
    if (objectKey === HEXOBJECT_KEYS.STONE_WALL) {
      board[hexKey(hex)] = 'wall';
      continue;
    }
    board[hexKey(hex)] = BATTLE_TERRAIN_OF[tile.terrain] ?? 'floor';
    if (objectKey === HEXOBJECT_KEYS.ROCK)
      boulders.push({ id: `boulder-${boulders.length + 1}`, pos: hex });
  }
  return { seed, biome, board, boulders };
}

export function generateBattlefield(biome: BattlefieldBiome, seed: string): Battlefield {
  const pipeline = runBoardPipeline(BATTLEFIELD_BIOMES[biome], { seed });
  return battlefieldFromPipeline(pipeline, biome, seed);
}
