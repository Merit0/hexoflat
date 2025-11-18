import type {LootItemModel} from "../models/LootItemModel.ts";

export interface IGrave {
    setGraveImagePath(imagePath: string): void,
    addLoot(lootItem: LootItemModel[]): void
}