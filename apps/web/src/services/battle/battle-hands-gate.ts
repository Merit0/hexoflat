import { bindInventoryHandsGate } from '@/stores/hero-inventory-store';
import { useBattleStore } from '@/stores/battle-store';
import { battleItemOfHexobject } from '@hexoflat/engine/battle/battle-catalogue';

export interface HandsGateDeps {
  send: (run: () => boolean) => boolean;
  lockedWarning: () => boolean;
}

function isOpen(): boolean {
  const battle = useBattleStore().battle;
  return !!battle && battle.phase !== 'ended';
}

function battleKey(key: string | null): string | null {
  return key ? (battleItemOfHexobject(key) ?? null) : null;
}

export function bindBattleHandsGate({ send, lockedWarning }: HandsGateDeps): void {
  bindInventoryHandsGate((hands) => {
    const battle = useBattleStore();
    if (!isOpen()) return true;
    if (lockedWarning()) return false;
    const right = battleKey(hands.weapon);
    const left = battleKey(hands.shield);
    return send(() => battle.act({ kind: 'set-hands', right, left }));
  }, isOpen);
}
