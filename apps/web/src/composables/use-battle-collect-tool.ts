import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';
import type { BattleHex } from '@hexoflat/engine/battle/battle-state';
import type { BattleStoreInstance } from '@/stores/battle-store';
import { collectHero } from './battle-collect';
import type { BattleWarningCode } from './battle-warning';

export function useBattleCollectTool(
  store: BattleStoreInstance,
  act: (action: BattleAction) => Promise<boolean>,
  warn: (code: BattleWarningCode, cost: number | null) => void,
) {
  async function lootGraveWithTool(at: BattleHex): Promise<boolean> {
    if (!collectHero(store.projection, store.localHeroIds)) {
      warn('FIGHT_NOT_OVER', null);
      return false;
    }
    const looted = await act({ kind: 'loot-grave', hex: at });
    const nothing = store.lastHeroEvents.some(
      (event) =>
        event.type === 'GRAVE_LOOTED' && (event.payload as { nothing?: boolean }).nothing === true,
    );
    if (looted && nothing) warn('CONTAINER_EMPTY', null);
    return looted;
  }

  return { lootGraveWithTool };
}
