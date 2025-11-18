import {defineStore} from "pinia";
import {LootItemModel} from "@/models/LootItemModel";
import EnemyModel from "@/models/EnemyModel";
import TileModel from "@/a-game-scenes/silesia-world-scene/models/tile-model";
import {GraveModel} from "@/a-game-scenes/battlefield-scene/grave/models/grave-model";
import {LootFactory} from "@/factory/loot-factory";
import {EnemyType} from "@/enums/EnemyType";

export const useGraveStore = defineStore("grave-store", {
    state: () => ({
        graveTile: null as TileModel | null,
        graveInventoryItems: [] as LootItemModel[],
        killedEnemyType: null as EnemyType,
    }),

    getters: {
        graveSlots: (state): (LootItemModel | null)[] => {
            const slots = [...state.graveInventoryItems];
            while (slots.length < 9) {
                slots.push(null);
            }
            return slots;
        },
    },

    actions: {
        buildGraveFromTile(tile: TileModel) {
            this.graveTile = tile;
            this.graveInventoryItems = tile.grave?.graveTreasureItems ?? [];
        },

        resetGrave() {
            this.graveInventoryItems = [];
            this.graveTile = null;
        },

        removeGraveInventoryItem(item: LootItemModel) {
            this.graveInventoryItems = this.graveInventoryItems.filter(
                (treasureItem: LootItemModel) => treasureItem.id !== item.id
            );

            const tile = this.graveTile;

            if (tile?.grave) {
                tile.grave.graveTreasureItems = tile.grave.graveTreasureItems.filter(
                    (treasureItem: LootItemModel) => treasureItem.id !== item.id
                );

                tile.grave = { ...tile.grave };
            }
        },

        generateGraveFromEnemy(enemy: EnemyModel): GraveModel {
            const grave = new GraveModel();
            const generatedLoot: LootItemModel[] = LootFactory.getLootFromEnemy(enemy);

            for (const item of generatedLoot) {
                item.place = 'grave';
            }
            this.killedEnemyType = enemy.enemyType;
            grave.addLoot(generatedLoot);

            return grave;
        }
    },
});