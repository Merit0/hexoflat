import {ItemType} from "../enums/ItemType.ts";
import type {LootItemModel} from "../models/LootItemModel.ts";


export interface IEquipment {
  weapon: LootItemModel & { itemType: ItemType.WEAPON };
  shield: LootItemModel;
  helm: LootItemModel;
  armor: LootItemModel;
  boots: LootItemModel;
  belt: LootItemModel;
  pants: LootItemModel;
  ring: LootItemModel;
}
