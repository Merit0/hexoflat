import EnemyModel from "@/models/EnemyModel";
import {EnemyBuilder} from "@/builders/EnemyBuilder";
import {EnemyType} from "@/enums/EnemyType";

export class AnimalProvider {
    private static animalImageRootFolder = '/images/creatures_500_500//forest-animals_500_500';

    public static getPig(): EnemyModel {
        return new EnemyBuilder()
            .enemyName(AnimalType.PIG)
            .enemyType(EnemyType.ANIMAL)
            .enemyImgPath(`${this.animalImageRootFolder}/${AnimalType.PIG.toLowerCase()}-animal-image.png`)
            .powerModifierLvl(0.5)
            .build();
    }

    public static getForestAnimals(): EnemyModel[] {
        return Array.of(
            this.getPig()
        );
    }
}

export enum AnimalType {
    BEAR = 'Bear',
    DEAR = 'Dear',
    PIG = 'Pig',
    PUMA = 'Puma',
    SNAKE = 'Snake',
    TIGER = 'Tiger',
    WOLF = 'Wolf',
}
