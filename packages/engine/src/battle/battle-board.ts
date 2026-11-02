import type {
  BattleCreature,
  BattleHex,
  BattleState,
  BattleTerrain,
  Boulder,
} from './battle-state';
import { hexKey, hexNeighbours, sameHex } from './hex-battle-geom';

export type BattleBoardView = Pick<BattleState, 'board' | 'creatures' | 'boulders'>;

const PASSABLE: ReadonlySet<BattleTerrain> = new Set(['floor', 'rubble', 'ledge', 'oil', 'saw']);

export function terrainAt(state: BattleBoardView, hex: BattleHex): BattleTerrain | null {
  return state.board[hexKey(hex)] ?? null;
}

export function heightAt(state: BattleBoardView, hex: BattleHex): number {
  return terrainAt(state, hex) === 'ledge' ? 1 : 0;
}

export function isPassableHex(state: BattleBoardView, hex: BattleHex): boolean {
  const terrain = terrainAt(state, hex);
  return terrain !== null && PASSABLE.has(terrain);
}

export function isAlive(creature: BattleCreature): boolean {
  return creature.hp > 0;
}

export function creatureById(state: BattleBoardView, id: string): BattleCreature | null {
  return state.creatures.find((c) => c.id === id) ?? null;
}

export function livingCreatureAt(state: BattleBoardView, hex: BattleHex): BattleCreature | null {
  return state.creatures.find((c) => isAlive(c) && sameHex(c.pos, hex)) ?? null;
}

export function boulderAt(state: BattleBoardView, hex: BattleHex): Boulder | null {
  return state.boulders.find((b) => sameHex(b.pos, hex)) ?? null;
}

export function isFreeHex(state: BattleBoardView, hex: BattleHex, ignoreId?: string): boolean {
  if (!isPassableHex(state, hex)) return false;
  const boulder = boulderAt(state, hex);
  if (boulder && boulder.id !== ignoreId) return false;
  const occupant = livingCreatureAt(state, hex);
  return !occupant || occupant.id === ignoreId;
}

export function freeNeighbours(
  state: BattleBoardView,
  hex: BattleHex,
  ignoreId?: string,
): BattleHex[] {
  return hexNeighbours(hex).filter((n) => isFreeHex(state, n, ignoreId));
}

export function strikeSideHexes(
  state: BattleBoardView,
  hex: BattleHex,
  ignoreId?: string,
): BattleHex[] {
  return freeNeighbours(state, hex, ignoreId).filter((n) => terrainAt(state, n) !== 'saw');
}

export function livingOnSide(
  state: BattleBoardView,
  side: BattleCreature['side'],
): BattleCreature[] {
  return state.creatures.filter((c) => c.side === side && isAlive(c));
}
