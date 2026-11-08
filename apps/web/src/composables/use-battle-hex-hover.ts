import { shallowRef } from 'vue';
import type { BattleHex } from '@hexoflat/engine/battle/battle-state';
import type { HexHoverAnchor } from '@/composables/use-hex-hover-info';

export interface BattleHexHoverTarget {
  hex: BattleHex;
  anchor: HexHoverAnchor;
}

const battleHexHoverTarget = shallowRef<BattleHexHoverTarget | null>(null);

export function useBattleHexHover() {
  function point(hex: BattleHex | null, anchor: HexHoverAnchor | null) {
    battleHexHoverTarget.value = hex && anchor ? { hex, anchor } : null;
  }

  return { target: battleHexHoverTarget, point };
}
