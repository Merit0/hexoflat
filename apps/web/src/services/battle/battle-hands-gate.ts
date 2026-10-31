import { bindInventoryHandsGate } from '@/stores/hero-inventory-store';
import { useBattleStore } from '@/stores/battle-store';

export interface HandsGateDeps {
  send: (run: () => boolean) => boolean;
  lockedWarning: () => boolean;
  hands: () => { right: string | null; left: string | null };
}

export function bindBattleHandsGate({ send, lockedWarning, hands }: HandsGateDeps): void {
  bindInventoryHandsGate(() => {
    const battle = useBattleStore();
    if (!battle.battle || battle.battle.phase === 'ended') return true;
    if (lockedWarning()) return false;
    const { right, left } = hands();
    return send(() => battle.act({ kind: 'set-hands', right, left }));
  });
}
