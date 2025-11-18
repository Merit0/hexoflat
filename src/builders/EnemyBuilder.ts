import EnemyModel from '@/models/EnemyModel';
import {EnemyType} from '@/enums/EnemyType';
import {LootItemModel} from '@/models/LootItemModel';
import {DiceFace} from "@/a-game-scenes/battlefield-scene/dice-roller/models/DiceModel";

interface IEnemyBuilder {
    enemyName(name: string): EnemyBuilder;
    enemyType(enemyType: EnemyType): EnemyBuilder;
    powerModifierLvl(modifierNumber: number): this;
    enemyLoot(enemyLootItem: LootItemModel[]): EnemyBuilder;
    enemyImgPath(imgPath: string): EnemyBuilder;
    enemyBackgroundSrc(imgPath: string): EnemyBuilder;
}

export class EnemyBuilder implements IEnemyBuilder {

    private enemy: EnemyModel;

    constructor() {
        this.reset();
    }

    private reset(): void {
        this.enemy = new EnemyModel();
    }

    public enemyName(name: string): EnemyBuilder {
        this.enemy.setName(name);
        return this;
    }

    public enemyAttack(attackValue: number): EnemyBuilder {
        this.enemy.setAttack(attackValue);
        return this;
    }

    public enemyType(enemyType: EnemyType): EnemyBuilder {
        this.enemy.setEnemyType(enemyType);
        return this;
    }

    public powerModifierLvl(modifierNumber: number): this {
        this.enemy.setPowerModifierLvl(modifierNumber);
        return this;
    }

    public enemyImgPath(imgPath: string): EnemyBuilder {
        this.enemy.setImageName(imgPath);
        return this;
    }

    public enemyBackgroundSrc(backgroundColor: string): EnemyBuilder {
        this.enemy.setEnemyBackgroundColor(backgroundColor);
        return this;
    }

    public enemyLoot(enemyLootItem: LootItemModel[]): EnemyBuilder {
        this.enemy.setLoot(enemyLootItem);
        return this;
    }

    public diceFaces(diceFaces: DiceFace[]): EnemyBuilder {
        this.enemy.enemyDiceFacesList = diceFaces;
        return this;
    }

    public diceWeights(dicesWeightValue: number[]): EnemyBuilder {
        this.enemy.enemyDiceWeightsList = dicesWeightValue;
        return this;
    }

    public build(): EnemyModel {
        const enemy = this.enemy;
        this.reset();
        enemy.generateAttack();
        enemy.generateHealth();
        return enemy;
    }
}