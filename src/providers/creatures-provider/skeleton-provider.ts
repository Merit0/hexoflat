import EnemyModel from "@/models/EnemyModel";
import {EnemyBuilder} from "@/builders/EnemyBuilder";
import {EnemyType} from "@/enums/EnemyType";
import {PantsProvider} from "@/providers/equipment-provider/pants-provider";
import {ArmorProvider} from "@/providers/armor-provider";

export class SkeletonProvider {
    private static skeletonsImageRootFolder = '/images/creatures_500_500/skeletons';

    public static getSkeleton(): EnemyModel {
        return new EnemyBuilder()
            .enemyName('Skeleton')
            .enemyAttack(20)
            .enemyType(EnemyType.WARRIOR)
            .enemyImgPath(`${this.skeletonsImageRootFolder}/skeleton.png`)
            .enemyLoot(
                [
                    PantsProvider.getElfPants(),
                    ArmorProvider.getLeatherArmor()
                ]
            )
            .build();
    }

    public static getSkeletons(): EnemyModel[] {
        return Array.of(
            this.getSkeleton(),
        );
    }
}
