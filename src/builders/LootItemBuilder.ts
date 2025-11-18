import {LootItemModel} from "@/models/LootItemModel";
import {Rarity} from "@/enums/Rarity";
import {ItemType} from "@/enums/ItemType";
import {Randomizer} from "@/utils/Randomizer";

interface ILootItemBuilder {
    lootItemName(name: string): LootItemBuilder;
    price(priceValue: number): LootItemBuilder;
    itemType(itemType: ItemType): LootItemBuilder;
    lootItemImgPath(imgPath: string): LootItemBuilder;
    lootRarity(rarity: Rarity): LootItemBuilder;
    lootValue(value: number): LootItemBuilder;
}

export class LootItemBuilder implements ILootItemBuilder {
    private loot: LootItemModel;

    constructor() {
        this.reset();
    }

    private reset() {
        this.loot = new LootItemModel();
    }

    public lootItemName(name: string): LootItemBuilder {
        this.loot.name = name;
        return this;
    }

    public itemType(itemType: ItemType): LootItemBuilder {
        this.loot.itemType = itemType;
        return this;
    }

    public lootItemImgPath(imgPath: string): LootItemBuilder {
        this.loot.imgPath = imgPath;
        return this;
    }

    public lootItemPoseImgPath(poseImgPath: string): LootItemBuilder {
        this.loot.poseImgPath = poseImgPath;
        return this;
    }

    public lootRarity(rarity: Rarity): LootItemBuilder {
        this.loot.rarity = rarity;
        return this;
    }

    public lootValue(value: number): LootItemBuilder {
        this.loot.value = value;
        return this;
    }

    public price(priceValue: number): LootItemBuilder {
        this.loot.price = priceValue;
        return this;
    }

    public generateAmount(): LootItemBuilder {
        if (this.loot.rarity === Rarity.COMMON) {
            this.loot.value = Randomizer.getRandomIntInRange(1, 10);
        }
        return this;
    }

    public build(): LootItemModel {
        const createdLoot = this.loot;
        this.reset();
        return createdLoot;
    }
}
