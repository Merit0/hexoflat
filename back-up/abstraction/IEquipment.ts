import {LootItemModel} from "@/models/LootItemModel";
import {ItemType} from "@/enums/ItemType";


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