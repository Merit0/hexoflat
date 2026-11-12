import { standsNextToCampObject } from '../content/boards/camp-object-spot';
import type { InventoryContext } from '../inventory/inventory-commands';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { Presence } from './progress-state';

export function serverInventoryContext(presence: Presence | null): InventoryContext {
  return {
    stashOpen: standsNextToCampObject(presence, HEXOBJECT_KEYS.STASH_CHEST),
    battleOpen: false,
  };
}
