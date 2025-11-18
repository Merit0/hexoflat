import {EnemyType} from "@/enums/EnemyType";
import {Rarity} from "@/enums/Rarity";

export interface IDropChance {
    coinChance: number;
    potionChance: number;
    itemDropChance: number;
    keyDropChance?: number;
}

export type RarityChanceMap = Record<Rarity, number>;

export class DropChanceGenerator {
    constructor(private enemyType: EnemyType) {
    }

    public generate(): IDropChance {
        switch (this.enemyType) {
            case EnemyType.BOSS:
                return {coinChance: 100, potionChance: 80, itemDropChance: 100, keyDropChance: 100};
            case EnemyType.CHEEF:
                return {coinChance: 90, potionChance: 50, itemDropChance: 80};
            case EnemyType.WARRIOR:
                return {coinChance: 60, potionChance: 25, itemDropChance: 50};
            case EnemyType.ANIMAL:
                return {coinChance: 0, potionChance: 0, itemDropChance: 100};
            default:
                return {coinChance: 50, potionChance: 0, itemDropChance: 30};
        }
    }

    public generateRarityMap(): RarityChanceMap {
        switch (this.enemyType) {
            case EnemyType.BOSS:
                return {
                    [Rarity.MYTHIC]: 100,
                    [Rarity.LEGEND]: 0,
                    [Rarity.EPIC]: 0,
                    [Rarity.RARE]: 0,
                    [Rarity.COMMON]: 0,
                };
            case EnemyType.CHEEF:
                return {
                    [Rarity.MYTHIC]: 0.5,
                    [Rarity.LEGEND]: 2,
                    [Rarity.EPIC]: 15,
                    [Rarity.RARE]: 30,
                    [Rarity.COMMON]: 52.5,
                };
            case EnemyType.WARRIOR:
                return {
                    [Rarity.MYTHIC]: 0.1,
                    [Rarity.LEGEND]: 1,
                    [Rarity.EPIC]: 10,
                    [Rarity.RARE]: 20,
                    [Rarity.COMMON]: 68.9,
                };
            case EnemyType.ANIMAL:
                return {
                    [Rarity.MYTHIC]: 0,
                    [Rarity.LEGEND]: 0,
                    [Rarity.EPIC]: 2,
                    [Rarity.RARE]: 8,
                    [Rarity.COMMON]: 90,
                };
            default:
                return {
                    [Rarity.MYTHIC]: 0,
                    [Rarity.LEGEND]: 0.5,
                    [Rarity.EPIC]: 5,
                    [Rarity.RARE]: 15,
                    [Rarity.COMMON]: 79.5,
                };
        }
    }
}