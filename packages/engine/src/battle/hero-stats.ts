import { resolveHeroStats, type HeroStats } from '../tokens/equipment/hero-stats';
import { hexobjectOfBattleItem } from './battle-catalogue';
import type { BattleCreature } from './battle-state';

export function battleHeroStats(creature: BattleCreature): HeroStats {
  const hands = [creature.hands.right, creature.hands.left].flatMap((item) => {
    if (!item) return [];
    const key = item.token?.type ?? hexobjectOfBattleItem(item.key);
    return key ? [{ key, token: item.token }] : [];
  });
  return resolveHeroStats([...hands, ...(creature.equipment ?? [])]);
}
