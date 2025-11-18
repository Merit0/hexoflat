import { IHeroItem } from "@/abstraction/IHeroItem";
import { ItemType } from "@/enums/ItemType";
import { Rarity } from "@/enums/Rarity";
import { v4 as uuid } from "uuid";

export class LootItemModel implements IHeroItem {
  name: string;
  value: number;
  price: number;
  imgPath: string;
  poseImgPath: string;
  borderFrame: string;
  itemType: ItemType;
  rarity: Rarity;
  id = uuid();
  place: "bag" | "chest" | "shop" | null | 'keeper' | 'grave';

  static mapToModel(data: any): LootItemModel {
    const item = new LootItemModel();

    item.name = data.name;
    item.value = data.value;
    item.price = data.price;
    item.imgPath = data.imgPath;
    item.poseImgPath = data.poseImgPath;
    item.borderFrame = data.borderFrame;
    item.itemType = data.itemType;
    item.rarity = data.rarity;
    item.id = data.id || uuid();
    item.place = data.place ?? null;

    return item;
  }
}
