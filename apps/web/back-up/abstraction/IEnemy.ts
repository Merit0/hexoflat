import type {LootItemModel} from "../models/LootItemModel.ts";
import type {DiceFace} from "../models/DiceModel.ts";
import type {EnemyType} from "../enums/EnemyType.ts";


export interface IEnemy {
    name: string;
    health: number;
    maxHealth: number;
    minHealth: number;
    attack: number;
    defense: number;
    id: number;
    enemyType: EnemyType;
    imgPath: string;
    enemyBackgroundColor: string;
    loot: LootItemModel[];
    powerModifierLvl: number;
    isAlive: boolean;
    isDead: boolean;
    enemyDiceFacesList: DiceFace[];
    enemyDiceWeightsList: number[];
}
