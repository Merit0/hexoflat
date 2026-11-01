import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { livingOnSide } from '@hexoflat/engine/battle/battle-board';
import { battleDistance } from '@hexoflat/engine/battle/hex-battle-geom';

export function effectiveTarget(
  view: BattleProjection | null,
  hero: BattleCreature | null,
  selectedId: string | null | undefined,
): BattleCreature | null {
  if (!view || !hero || view.phase === 'ended') return null;
  const foes = livingOnSide(view, hero.side === 'heroes' ? 'enemies' : 'heroes');
  const picked = foes.find((foe) => foe.id === selectedId);
  if (picked) return picked;
  let closest: BattleCreature | null = null;
  for (const foe of foes) {
    if (!closest || battleDistance(hero.pos, foe.pos) < battleDistance(hero.pos, closest.pos)) {
      closest = foe;
    }
  }
  return closest;
}
