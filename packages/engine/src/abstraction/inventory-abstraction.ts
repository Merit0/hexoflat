import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { EHexobjectGroup, TEquipSlot } from './hexobject-abstraction';

export interface InventoryItem {
  id: string;
  key: THexobjectKey;
  type: EHexobjectGroup;

  stackKey?: string;
  amount: number;

  equipSlot?: TEquipSlot;

  slotKey: string;
  isNew: boolean;
}
