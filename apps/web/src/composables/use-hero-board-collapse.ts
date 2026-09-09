import { ref } from 'vue';

/**
 * Module-scoped (not per-component) so the toggle handle — rendered in
 * hex-world-map.vue, outside the panel so it stays reachable while the
 * panel is slid away — and the panel itself (hero-board-panel.vue) read and
 * write the same open/closed flag without a prop/emit relay between two
 * sibling components. Same pattern as use-inventory-drag.ts's module-level
 * `inventoryDragState`.
 */
export const isHeroBoardOpen = ref(true);

export function toggleHeroBoardOpen(): void {
  isHeroBoardOpen.value = !isHeroBoardOpen.value;
}
