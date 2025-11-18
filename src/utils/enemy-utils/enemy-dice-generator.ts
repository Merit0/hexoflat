import {DiceModel} from "@/a-game-scenes/battlefield-scene/dice-roller/models/DiceModel";
import EnemyModel from "@/models/EnemyModel";

export class EnemyDiceGenerator {
    static generate(enemy: EnemyModel): DiceModel[] {
        const enemySingleDice: DiceModel = new DiceModel(
            enemy.enemyDiceFacesList,
            enemy.enemyDiceWeightsList
        );
        return [
            enemySingleDice,
            enemySingleDice,
            enemySingleDice,
        ];
    }
}
