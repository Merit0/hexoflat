import { isHeroBoardOpen } from '@/composables/use-hero-board-collapse';
import { dragCancel } from '@/composables/use-stash-drag';
import { i18n } from '@/i18n';
import { claimCampChest } from '@/services/inventory/inventory-sync';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';

/** Opens the board; the first time, the server hands over the free camp chest and its gear. */
export async function openStashBoard(): Promise<boolean> {
  const claimed = await claimCampChest();
  if (!claimed.ok) {
    useHeroToolStore().setActionMessage(
      i18n.global.t('player.sync.claimFailed'),
      null,
      null,
      'warn',
    );
    return false;
  }
  useHeroStashStore().open();
  isHeroBoardOpen.value = true;
  return true;
}

export function closeStashBoard() {
  dragCancel();
  useHeroStashStore().close();
}
