import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { ItemToken } from '../tokens/token-schema';
import type { EHexobjectGroup, TEquipSlot } from './hexobject-abstraction';

export interface InventoryItem {
  id: string;
  key: THexobjectKey;
  type: EHexobjectGroup;

  stackKey?: string;
  amount: number;
  token?: ItemToken;

  equipSlot?: TEquipSlot;

  slotKey: string;
  isNew: boolean;
}
