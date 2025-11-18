import type {LootItemModel} from "../models/LootItemModel.ts";


export interface IChest {
    setImagePath(imagePath: string): void,
    addLoot(lootItem: LootItemModel[]): void
}
