import { isHeroBoardOpen } from '@/composables/use-hero-board-collapse';
import { dragCancel } from '@/composables/use-stash-drag';
import { useHeroStashStore } from '@/stores/hero-stash-store';

export function openStashBoard() {
  useHeroStashStore().open();
  isHeroBoardOpen.value = true;
}

export function closeStashBoard() {
  dragCancel();
  useHeroStashStore().close();
}
