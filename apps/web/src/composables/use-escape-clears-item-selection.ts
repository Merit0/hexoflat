import { onBeforeUnmount, onMounted } from 'vue';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';

export function useEscapeClearsItemSelection() {
  const inventory = useHeroInventoryStore();

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !inventory.selectedItemId) return;
    event.preventDefault();
    inventory.clearSelection();
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown));
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));
}
