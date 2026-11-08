import { i18n } from '@/i18n';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import type { StashFilter } from './stash-filter';
import type { TTransferError } from '@hexoflat/engine/inventory/item-transfer';
import type { StashDropLabel } from './stash-drop-label';

const t = (key: string, params?: Record<string, unknown>): string =>
  i18n.global.t(key, params ?? {});

export function stashErrorText(reason: TTransferError): string {
  switch (reason) {
    case 'WRONG_SLOT':
      return t('stash.error.WRONG_SLOT');
    case 'SWAP_WRONG_SLOT':
      return t('stash.error.SWAP_WRONG_SLOT');
    case 'STACK_FULL':
      return t('stash.error.STACK_FULL');
    case 'SPLIT_TARGET_TAKEN':
      return t('stash.error.SPLIT_TARGET_TAKEN');
    case 'OVERWEIGHT':
      return t('stash.error.OVERWEIGHT');
    case 'CONTAINER_FULL':
      return t('stash.error.CONTAINER_FULL');
    case 'STASH_LOCKED':
      return t('stash.error.STASH_LOCKED');
    case 'NO_CHEST':
      return t('stash.error.NO_CHEST');
    case 'EMPTY_SOURCE':
      return t('stash.error.EMPTY_SOURCE');
    case 'INVALID_LOCATION':
      return t('stash.error.INVALID_LOCATION');
  }
}

export function stashDropText(label: StashDropLabel): string {
  switch (label.id) {
    case 'swap':
      return t('stash.drop.swap');
    case 'merge':
      return t('stash.drop.merge', { n: label.count });
    case 'split':
      return t('stash.drop.split', { n: label.count });
    case 'equip':
      return t('stash.drop.equip');
    case 'toBag':
      return t('stash.drop.toBag');
    case 'toStash':
      return t('stash.drop.toStash');
    case 'cant':
      return t('stash.drop.cant');
  }
}

export function warnHero(text: string): void {
  useHeroToolStore().setActionMessage(text);
}

export function stashFilterText(filter: StashFilter): string {
  switch (filter) {
    case 'all':
      return t('stash.filter.all');
    case 'gear':
      return t('stash.filter.gear');
    case 'tool':
      return t('stash.filter.tool');
    case 'resource':
      return t('stash.filter.resource');
    case 'consumable':
      return t('stash.filter.consumable');
  }
}

export function stashMoreText(count: number): string {
  return t('stash.moreBelow', { n: count });
}

export function stashNothingToStoreText(): string {
  return t('stash.nothingToStore');
}
