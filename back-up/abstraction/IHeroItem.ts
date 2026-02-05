import type {ItemType} from "../enums/ItemType.ts";
import type {Rarity} from "../enums/Rarity.ts";


export interface IHeroItem {
  name: string;
  value: number;
  price: number;
  imgPath: string;
  poseImgPath: string;
  borderFrame: string;
  itemType: ItemType;
  rarity: Rarity;
  id: string;
}
