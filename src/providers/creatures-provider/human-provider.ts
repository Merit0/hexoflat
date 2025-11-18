import EnemyModel from "@/models/EnemyModel";
import {EnemyBuilder} from "@/builders/EnemyBuilder";
import {EnemyType} from "@/enums/EnemyType";
import {BootsProvider} from "@/providers/boots-provider";
import {HelmetProvider} from "@/providers/helmet-provider";

export class HumanProvider {
    private static skeletonsImageRootFolder = '/images/creatures_500_500/humans_500_500';

    public static getThief(): EnemyModel {
        return new EnemyBuilder()
            .enemyName('Thief')
            .enemyType(EnemyType.WARRIOR)
            .enemyImgPath(`${this.skeletonsImageRootFolder}/male-thief-enemy-image.png`)
            .enemyLoot(
                [
                    BootsProvider.getLeatherBoots(),
                    HelmetProvider.getIronHat(),
                ]
            )
            .build();
    }

    public static getThieves(): EnemyModel[] {
        return Array.of(
            this.getThief(),
        );
    }
}
