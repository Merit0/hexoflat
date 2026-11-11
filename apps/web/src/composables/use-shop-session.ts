import { onBeforeUnmount, onMounted, watch } from 'vue';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { closeShopBoard } from '@/composables/use-shop-board';
import { shopDrag } from '@/composables/shop-drag-state';
import { refreshConfirming } from '@/composables/use-shop-refresh';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroStore } from '@/stores/hero-store';
import { useTraderStore } from '@/stores/trader-store';
import { useWorldMapStore } from '@/stores/world-map-store';

function heroSpot(coordinates: { columnIndex: number; rowIndex: number } | null): string {
  return coordinates ? `${coordinates.columnIndex}:${coordinates.rowIndex}` : 'none';
}

export function useShopSession() {
  const trader = useTraderStore();
  const hero = useHeroStore();
  const battle = useBattleStore();
  const world = useWorldMapStore();
  const stash = useHeroStashStore();

  function closeIfOpen() {
    if (trader.isOpen) closeShopBoard();
  }

  watch(
    [() => heroSpot(hero.heroCoordinates), () => world.currentLocationKey, () => battle.inBattle],
    closeIfOpen,
  );

  watch(
    () => stash.isOpen,
    (open) => open && closeIfOpen(),
  );

  watch(knowledgePanelMode, (mode) => mode && closeIfOpen());

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || shopDrag.active || refreshConfirming.value) return;
    closeIfOpen();
  }

  onMounted(() => window.addEventListener('keydown', onKeydown));
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
}
