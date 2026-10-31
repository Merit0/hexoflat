import type { BattleHex } from '@hexoflat/engine/battle/battle-state';
import { hexKey } from '@hexoflat/engine/battle/hex-battle-geom';
import { BATTLE_MOTION } from './battle-timing';
import type { Point } from './battle-animation-sample';

export function woundDrops(
  wounds: readonly BattleHex[],
  centreOf: (hex: BattleHex) => Point,
  tileHeight: number,
): Point[] {
  const byHex = new Map<string, { hex: BattleHex; count: number }>();
  for (const hex of wounds) {
    const key = hexKey(hex);
    byHex.set(key, { hex, count: (byHex.get(key)?.count ?? 0) + 1 });
  }
  const drops: Point[] = [];
  for (const { hex, count } of byHex.values()) {
    const centre = centreOf(hex);
    const shown = Math.min(count, BATTLE_MOTION.maxDropsPerSide);
    for (let i = 0; i < shown; i++) {
      const offset = (i - (shown - 1) / 2) * tileHeight * BATTLE_MOTION.dropSpreadTiles;
      drops.push({ x: centre.x + offset, y: centre.y });
    }
  }
  return drops;
}
