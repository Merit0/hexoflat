import { onBeforeUnmount, onMounted, watch } from 'vue';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { closeStashBoard } from '@/composables/use-stash-board';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';

function heroSpot(coordinates: { columnIndex: number; rowIndex: number } | null): string {
  return coordinates ? `${coordinates.columnIndex}:${coordinates.rowIndex}` : 'none';
}

/**
 * The open stash belongs to the hero standing at the chest: it closes when the hero walks away,
 * leaves the location, a battle starts, the Book of Will opens or Escape is pressed.
 */
export function useStashSession() {
  const stash = useHeroStashStore();
  const hero = useHeroStore();
  const battle = useBattleStore();
  const world = useWorldMapStore();

  watch(
    [
      () => heroSpot(hero.heroCoordinates),
      () => world.currentLocationKey,
      () => battle.inBattle,
      () => knowledgePanelMode.value,
    ],
    () => {
      if (stash.isOpen) closeStashBoard();
    },
  );

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && stash.isOpen) closeStashBoard();
  }

  onMounted(() => window.addEventListener('keydown', onKeydown));
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
}
