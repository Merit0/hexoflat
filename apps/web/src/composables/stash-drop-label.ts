import type { TTransferResult } from '@hexoflat/engine/inventory/item-transfer';
import type { StashDropTarget } from './stash-drag-state';

export type StashDropLabelId = 'swap' | 'merge' | 'split' | 'equip' | 'toBag' | 'toStash' | 'cant';

export interface StashDropLabel {
  id: StashDropLabelId;
  tone: 'ok' | 'bad';
  count: number;
}

export function describeDrop(
  preview: TTransferResult | null,
  target: StashDropTarget | null,
): StashDropLabel | null {
  if (!preview || !target) return null;
  if (!preview.ok) return { id: 'cant', tone: 'bad', count: 0 };
  if (preview.kind === 'noop') return null;
  if (target.kind === 'zone') {
    return { id: target.container === 'bag' ? 'toBag' : 'toStash', tone: 'ok', count: 0 };
  }
  const known = ['swap', 'merge', 'split', 'equip'] as const;
  const id = known.find((candidate) => candidate === preview.kind);
  return id ? { id, tone: 'ok', count: preview.moved } : null;
}
