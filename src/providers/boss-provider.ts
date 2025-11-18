import {EnemyBuilder} from "@/builders/EnemyBuilder";
import {EnemyType} from "@/enums/EnemyType";
import EnemyModel from "@/models/EnemyModel";
import {HelmetProvider} from "@/providers/helmet-provider";
import {WeaponProvider} from "@/providers/WeaponProvider";
import {ShieldProvider} from "@/providers/shield-provider";

export class BossProvider {
    private static creaturesImageRootFolder = '/images/creatures_500_500/';

    public static getSkeletonBoss(): EnemyModel {
        return new EnemyBuilder()
            .enemyName("Skeletor")
            .enemyAttack(50)
            .enemyType(EnemyType.BOSS)
            .enemyImgPath(this.creaturesImageRootFolder + "skeletons/boss-skeletor.png")
            .enemyBackgroundSrc('rgb(157 118 118)')
            .enemyLoot([HelmetProvider.getMandalorianHelmet(), WeaponProvider.getDarkSaber()])
            .build();
    }

    public static getThiefBoss(): EnemyModel {
        return new EnemyBuilder()
            .enemyName("Robin Hood")
            .enemyType(EnemyType.BOSS)
            .enemyImgPath(this.creaturesImageRootFolder + "humans_500_500/boss-robbin-hood-image.png")
            .enemyBackgroundSrc('rgb(157 118 118)')
            .enemyLoot([WeaponProvider.getMolner(), ShieldProvider.getRoundWoodenShield()])
            .build();
    }
}