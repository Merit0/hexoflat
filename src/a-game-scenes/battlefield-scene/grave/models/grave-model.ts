import {LootItemModel} from "../../../../models/LootItemModel";
import {IGrave} from "@/abstraction/grave-interface";

export class GraveModel implements IGrave {
    graveTreasureItems: LootItemModel[] = Array.from({length: 9}, () => new LootItemModel());
    graveImgPath = '';

    public setGraveImagePath(imagePath: string): void {
        this.graveImgPath = imagePath;
    }

    public addLoot(lootItems: LootItemModel[]): void {
        for (const item of lootItems) {
            const emptyIndex = this.graveTreasureItems.findIndex((treasureItem: LootItemModel) => !treasureItem.name);

            if (emptyIndex !== -1) {
                this.graveTreasureItems[emptyIndex] = item;
            } else {
                this.graveTreasureItems.unshift(item);
                this.graveTreasureItems.pop();
            }
        }
    }
}
