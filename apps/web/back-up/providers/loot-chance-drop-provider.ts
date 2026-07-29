import {ILootChanceConfig} from "@/providers/loot-provider";

export class DropLootChanceConfigProvider {
    static getCommonDropChanceConfig(): ILootChanceConfig {
        return {
            equipmentDropChance: 30,
            common: 95,
            rare: 3,
            epic: 2,
            legend: 1
        };
    }

    static getBossDropChanceConfig(): ILootChanceConfig {
        return {
            equipmentDropChance: 100,
            common: 0,
            rare: 0,
            epic: 0,
            legend: 100
        };
    }
}