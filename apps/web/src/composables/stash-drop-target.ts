import { EQUIP_SLOTS, type TEquipSlot } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { StashDropTarget } from './stash-drag-state';

function equipSlotOf(value: string | undefined): TEquipSlot | null {
  return EQUIP_SLOTS.find((slot) => slot === value) ?? null;
}

function cellTarget(element: HTMLElement): StashDropTarget | null {
  const { dropContainer, dropIndex, dropSlot } = element.dataset;
  if (dropContainer === 'equip') {
    const slot = equipSlotOf(dropSlot);
    return slot ? { kind: 'cell', at: { container: 'equip', slot } } : null;
  }
  if (dropContainer !== 'bag' && dropContainer !== 'stash') return null;
  const index = Number(dropIndex);
  return Number.isInteger(index) ? { kind: 'cell', at: { container: dropContainer, index } } : null;
}

/** A cell under the pointer wins; otherwise the pane the pointer is over. */
export function resolveDropTarget(elements: Element[]): StashDropTarget | null {
  const html = elements.filter((element): element is HTMLElement => element instanceof HTMLElement);
  const cell = html.find((element) => element.dataset.dropContainer !== undefined);
  if (cell) return cellTarget(cell);
  const zone = html.find((element) => element.dataset.zone !== undefined)?.dataset.zone;
  return zone === 'bag' || zone === 'stash' ? { kind: 'zone', container: zone } : null;
}
