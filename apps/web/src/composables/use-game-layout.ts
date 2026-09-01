import { computed } from 'vue';
import { isHeroBoardOpen } from '@/composables/use-hero-board-collapse';

/**
 * Single source of truth for the desktop map/hero-board split — read by
 * hex-world-map.vue's grid CSS via `sceneLayoutStyle` so the percentages
 * only ever live here, not duplicated as literals in the component's
 * <style> block. Reacts to the collapse toggle: 70/30 while the panel is
 * open, 98/2 while it's collapsed to its edge rail.
 */
const HERO_BOARD_PANEL_WIDTH_PERCENT = 30;
const HERO_BOARD_COLLAPSED_WIDTH_PERCENT = 2;

export function useGameLayout() {
  const heroBoardPanelWidthPercent = computed(() =>
    isHeroBoardOpen.value ? HERO_BOARD_PANEL_WIDTH_PERCENT : HERO_BOARD_COLLAPSED_WIDTH_PERCENT,
  );
  const mapPaneWidthPercent = computed(() => 100 - heroBoardPanelWidthPercent.value);

  const sceneLayoutStyle = computed(() => ({
    '--map-pane-width': `${mapPaneWidthPercent.value}%`,
    '--hero-board-panel-width': `${heroBoardPanelWidthPercent.value}%`,
  }));

  return { heroBoardPanelWidthPercent, mapPaneWidthPercent, sceneLayoutStyle };
}
