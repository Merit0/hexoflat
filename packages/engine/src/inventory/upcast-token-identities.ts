import { tokenSourceIdOf } from '../tokens/game-tokens';

export function upcastTokenIdentities(old: unknown, ctx: { heroId: string }): unknown {
  if (!old || typeof old !== 'object') return old;
  const state = structuredClone(old) as {
    bag?: Cell[];
    equip?: Record<string, Cell>;
    stash?: { cells?: Cell[] };
  };
  const cells = [
    ...(state.bag ?? []),
    ...Object.values(state.equip ?? {}),
    ...(state.stash?.cells ?? []),
  ];
  const reserved = new Set(cells.flatMap((cell) => (cell?.token ? [cell.token.id] : [])));
  const seen = new Set<string>();
  let n = 0;
  for (const cell of cells) {
    if (!cell?.token) continue;
    if (seen.has(cell.token.id)) {
      let id: string;
      do {
        id = `${tokenSourceIdOf('repair', ctx.heroId)}:${n++}`;
      } while (reserved.has(id));
      cell.token.id = id;
      reserved.add(id);
    }
    seen.add(cell.token.id);
  }
  return state;
}

type Cell = { token?: { id: string } } | null;
