import {EnemyType} from "@/enums/EnemyType";
import {IEnemy} from "@/abstraction/IEnemy";
import {Randomizer} from "@/utils/Randomizer";
import {LootItemModel} from "./LootItemModel";
import {DiceFace} from "../../back-up/scenes/battlefield-scene/dice-roller/models/DiceModel";

export default class EnemyModel implements IEnemy {
    name: string;
    enemyType: EnemyType;
    maxHealth: number;
    minHealth: number;
    health: number;
    attack: number;
    defense: number;
    id: number;
    powerModifierLvl = 0;
    imgPath: string;
    enemyBackgroundColor: string;
    loot: LootItemModel[];
    enemyDiceFacesList: DiceFace[];
    enemyDiceWeightsList: number[];


    constructor() {
        this.id = 1;
        this.defense = 0;
        this.attack = 5;
        this.enemyDiceFacesList = ['sword', 'coin'];
        this.enemyDiceWeightsList = [1, 1];
    }

    public setDiceFaces(diceFaces: DiceFace[]): void {
        this.enemyDiceFacesList = diceFaces;
    }

    public getDiceFaces(): DiceFace[] {
        if (!this.enemyDiceFacesList) {
            this.enemyDiceFacesList = ['sword', 'coin'];
        }

        return this.enemyDiceFacesList;
    }

    get isAlive(): boolean {
        return this.health > 0;
    }

    get isDead(): boolean {
        return this.health <= 0;
    }

    public getName(): string {
        return this.name;
    }

    public getType(): EnemyType {
        return this.enemyType;
    }

    public getHealth(): number {
        return this.health;
    }

    public setAttack(attackValue: number): void {
        this.attack = attackValue;
    }

    public getAttack(): number {
        return this.attack;
    }

    public getDefense(): number {
        return this.defense;
    }

    public getId(): number {
        return this.id;
    }

    public getLoot(): LootItemModel[] {
        return this.loot;
    }

    public getImgPath(): string {
        return this.imgPath;
    }

    public setId(id: number): EnemyModel {
        this.id = id;
        this.name += " " + id;
        return this;
    }

    public setPowerModifierLvl(modifierNumber: number): void {
        this.powerModifierLvl = modifierNumber;
    }

    public setName(name: string): void {
        this.name = name;
    }

    public setImageName(imagePath: string): void {
        this.imgPath = imagePath;
    }

    public setEnemyType(enemyType: EnemyType): void {
        this.enemyType = enemyType;
    }

    public setEnemyBackgroundColor(backgroundColor: string): void {
        this.enemyBackgroundColor = backgroundColor;
    }

    public setLoot(lootItem: LootItemModel[]): void {
        this.loot = lootItem;
    }

    public takeDamage(damage: number): void {
        this.health -= damage;
    }

    public generateHealth() {
        if (this.enemyType === EnemyType.BOSS) {
            this.maxHealth = 300 * (this.powerModifierLvl + 1);
        } else {
            this.maxHealth = 20 * (this.powerModifierLvl + 1);
        }
        this.minHealth = Math.floor(this.maxHealth / 2);
        const randomHealth = Randomizer.getRandomIntInRange(
            this.minHealth,
            this.maxHealth
        );
        this.health = randomHealth < this.maxHealth ? randomHealth : this.maxHealth;
    }

    public generateAttack() {
        if (this.enemyType === EnemyType.BOSS) {
            this.attack = Randomizer.getRandomIntInRange(
                this.attack,
                this.attack * (this.powerModifierLvl + 5)
            );
        } else {
            this.attack = Randomizer.getRandomIntInRange(
                this.attack,
                this.attack * (this.powerModifierLvl + 1)
            );
        }
    }

    static mapToModel(data: any): EnemyModel {
        const enemy = new EnemyModel();
        Object.assign(enemy, data);
        return enemy;
    }
}