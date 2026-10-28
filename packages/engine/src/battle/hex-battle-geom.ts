import { AXIAL_DIRS } from '../utils/hex-utils';
import type { BattleHex } from './battle-state';

export function hexKey(hex: BattleHex): string {
  return `${hex.q},${hex.r}`;
}

export function parseHexKey(key: string): BattleHex {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export function sameHex(a: BattleHex, b: BattleHex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexNeighbours(hex: BattleHex): BattleHex[] {
  return AXIAL_DIRS.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

export function battleDistance(a: BattleHex, b: BattleHex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

export function isAdjacentHex(a: BattleHex, b: BattleHex): boolean {
  return battleDistance(a, b) === 1;
}

export function directionIndex(from: BattleHex, to: BattleHex): number {
  return AXIAL_DIRS.findIndex((d) => from.q + d.q === to.q && from.r + d.r === to.r);
}

export function hexInDirection(hex: BattleHex, index: number, steps = 1): BattleHex {
  const d = AXIAL_DIRS[((index % 6) + 6) % 6];
  return { q: hex.q + d.q * steps, r: hex.r + d.r * steps };
}

export function archerArc(target: BattleHex, archer: BattleHex): BattleHex[] {
  const around = hexNeighbours(target);
  let nearest = 0;
  around.forEach((hex, index) => {
    if (battleDistance(hex, archer) < battleDistance(around[nearest], archer)) nearest = index;
  });
  return [nearest - 1, nearest, nearest + 1].map((index) => hexInDirection(target, index));
}
