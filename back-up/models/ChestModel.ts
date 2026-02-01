import {LootItemModel} from "./LootItemModel";
import {IChest} from "@/abstraction/chest-interface";

export class ChestModel implements IChest {
    items: LootItemModel[] = Array.from({ length: 9 }, () => new LootItemModel());
    imgPath = '';

    public setImagePath(imagePath: string): void {
        this.imgPath = imagePath;
    }

    public addLoot(lootItems: LootItemModel[]): void {
        for (const item of lootItems) {
            const emptyIndex = this.items.findIndex(i => !i.name); // Або i.isEmpty()
            if (emptyIndex !== -1) {
                this.items[emptyIndex] = item;
            } else {
                // Якщо немає місця — вставляємо зверху та видаляємо останній
                this.items.unshift(item);
                this.items.pop();
            }
        }
    }
}
