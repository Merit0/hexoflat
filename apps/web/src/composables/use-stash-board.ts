import { isHeroBoardOpen } from '@/composables/use-hero-board-collapse';
import { useHeroStashStore } from '@/stores/hero-stash-store';

export function openStashBoard() {
  useHeroStashStore().open();
  isHeroBoardOpen.value = true;
}

export function closeStashBoard() {
  useHeroStashStore().close();
}
