import {LootItemModel} from "@/models/LootItemModel";
import {EquipmentGroupProvider} from "@/providers/equipment-group-provider";
import {ElixirsProvider} from "@/providers/elixir-provider";
import {CoinsProvider} from "@/providers/coins-provider";
import {Randomizer} from "@/utils/Randomizer";

export interface ILootChanceConfig {
    equipmentDropChance: number;
    common: number,
    rare: number,
    epic: number,
    legend: number,
}

export class EnemyLootProvider {
    static getLoot(dropChanceConfig: ILootChanceConfig): LootItemModel[] {
        const loot: LootItemModel[] = [];

        if (Randomizer.getChance(30)) {
            loot.push(ElixirsProvider.getCommonElixir());
        } else {
            const coinsNumber = Randomizer.getRandomIntInRange(1, 3);
            loot.push(CoinsProvider.getCoinsByEnemyType(null));
        }

        if (Randomizer.getChance(dropChanceConfig.equipmentDropChance)) {
            let accumulated = 0;
            const roll = Math.random() * 100;
            let item: LootItemModel | null = null;

            if (roll < (accumulated += dropChanceConfig.common)) {
                item = Randomizer.getRandomEquipment(EquipmentGroupProvider.getCommonEquipment());
            } else if (roll < (accumulated += dropChanceConfig.rare)) {
                item = Randomizer.getRandomEquipment(EquipmentGroupProvider.getRareEquipment());
            } else if (roll < (accumulated += dropChanceConfig.epic)) {
                item = Randomizer.getRandomEquipment(EquipmentGroupProvider.getRareEquipment());
            } else if (roll < (accumulated + dropChanceConfig.legend)) {
                item = Randomizer.getRandomEquipment(EquipmentGroupProvider.getRareEquipment());
            }

            if (item) loot.push(item);
        }

        return loot;
    }
}
