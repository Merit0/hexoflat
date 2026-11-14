import type { BattleCreature, BattleHex } from '@hexoflat/engine/battle/battle-state';
import { isAlive, isFreeHex } from '@hexoflat/engine/battle/battle-board';
import {
  hexKey,
  hexNeighbours,
  isAdjacentHex,
  sameHex,
} from '@hexoflat/engine/battle/hex-battle-geom';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';

export type CollectToolAction = 'eye' | 'take';

export interface CollectToolTarget {
  at: BattleHex;
  action: CollectToolAction;
}

export function inCollect(view: BattleProjection | null): boolean {
  return !!view && view.phase === 'ended' && view.outcome === 'victory' && !!view.collect;
}

export function collectHero(
  view: BattleProjection | null,
  localHeroIds: readonly string[],
): BattleCreature | null {
  if (!view || !inCollect(view)) return null;
  return (
    view.creatures.find((c) => c.side === 'heroes' && localHeroIds.includes(c.id) && isAlive(c)) ??
    null
  );
}

export function collectRoute(
  view: BattleProjection,
  self: BattleCreature,
  goal: BattleHex,
): BattleHex[] {
  if (sameHex(self.pos, goal) || !isFreeHex(view, goal)) return [];
  const cameFrom = new Map<string, BattleHex | null>([[hexKey(self.pos), null]]);
  const queue: BattleHex[] = [self.pos];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (sameHex(current, goal)) break;
    for (const next of hexNeighbours(current)) {
      const key = hexKey(next);
      if (cameFrom.has(key) || !isFreeHex(view, next)) continue;
      cameFrom.set(key, current);
      queue.push(next);
    }
  }
  if (!cameFrom.has(hexKey(goal))) return [];
  const path: BattleHex[] = [];
  for (let at: BattleHex | null = goal; at && !sameHex(at, self.pos);) {
    path.unshift({ q: at.q, r: at.r });
    at = cameFrom.get(hexKey(at)) ?? null;
  }
  return path;
}

function targetAt(view: BattleProjection, hex: BattleHex): CollectToolAction | null {
  const collect = view.collect!;
  if (collect.graves.some((grave) => sameHex(grave.hex, hex))) return 'eye';
  if (collect.items.some((item) => sameHex(item.hex, hex))) return 'take';
  return null;
}

export function collectToolTarget(
  view: BattleProjection,
  self: BattleCreature,
  preferred: BattleHex | null,
): CollectToolTarget | null {
  const around = hexNeighbours(self.pos).filter((hex) => isAdjacentHex(self.pos, hex));
  const hexes = preferred && around.some((hex) => sameHex(hex, preferred)) ? [preferred] : [];
  for (const hex of [...hexes, ...around]) {
    const action = targetAt(view, hex);
    if (action) return { at: { q: hex.q, r: hex.r }, action };
  }
  return null;
}

export function deadEnemyAt(view: BattleProjection, hex: BattleHex): boolean {
  return view.creatures.some((c) => c.side === 'enemies' && !isAlive(c) && sameHex(c.pos, hex));
}

export function actingHero(
  view: BattleProjection | null,
  localHeroIds: readonly string[],
  fightingHero: (view: BattleProjection | null, ids: readonly string[]) => BattleCreature | null,
): BattleCreature | null {
  return fightingHero(view, localHeroIds) ?? collectHero(view, localHeroIds);
}
