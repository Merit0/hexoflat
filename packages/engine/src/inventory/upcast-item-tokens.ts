import { ETokenType } from '../abstraction/hexobject-abstraction';
import { gameTokenFactory, isTokenType, tokenSourceIdOf } from '../tokens/game-tokens';
import type { ItemToken } from '../tokens/token-schema';

export const UPCAST_MAP_TIER = 1;

interface StoredCell {
  key?: unknown;
  amount?: unknown;
  stackKey?: unknown;
  token?: unknown;
}

interface StoredInventory {
  bag?: unknown;
  equip?: unknown;
  stash?: { cells?: unknown };
}

export function upcastSourceId(heroId: string, slot: string): string {
  return tokenSourceIdOf('upcast', heroId, slot);
}

export function upcastSeed(heroId: string): string {
  return `upcast-seed/${heroId}`;
}

function isTokenizable(cell: StoredCell): cell is StoredCell & { key: string } {
  return (
    typeof cell.key === 'string' &&
    isTokenType(cell.key) &&
    cell.amount === 1 &&
    cell.stackKey === undefined &&
    cell.token === undefined
  );
}

export function upcastToken(heroId: string, slot: string, type: string): ItemToken | null {
  const result = gameTokenFactory().createBase({
    seed: upcastSeed(heroId),
    sourceId: upcastSourceId(heroId, slot),
    n: 0,
    tokenType: ETokenType.IDOL,
    mapTier: UPCAST_MAP_TIER,
    type,
  });
  return result.ok ? result.value : null;
}

function upcastCell(heroId: string, slot: string, cell: unknown): unknown {
  if (cell === null || typeof cell !== 'object') return cell;
  const stored: StoredCell = cell;
  if (!isTokenizable(stored)) return cell;
  const token = upcastToken(heroId, slot, stored.key);
  return token ? { ...stored, token } : cell;
}

function upcastList(heroId: string, area: string, cells: unknown): unknown {
  if (!Array.isArray(cells)) return cells;
  return cells.map((cell, index) => upcastCell(heroId, `${area}.${index}`, cell));
}

function upcastEquip(heroId: string, equip: unknown): unknown {
  if (equip === null || typeof equip !== 'object') return equip;
  return Object.fromEntries(
    Object.entries(equip).map(([slot, cell]) => [slot, upcastCell(heroId, `equip.${slot}`, cell)]),
  );
}

export function upcastInventoryTokens(old: unknown, ctx: { heroId: string }): unknown {
  if (old === null || typeof old !== 'object') return old;
  const stored = old as StoredInventory;
  return {
    ...stored,
    bag: upcastList(ctx.heroId, 'bag', stored.bag),
    equip: upcastEquip(ctx.heroId, stored.equip),
    ...(stored.stash && typeof stored.stash === 'object'
      ? { stash: { ...stored.stash, cells: upcastList(ctx.heroId, 'stash', stored.stash.cells) } }
      : {}),
  };
}
