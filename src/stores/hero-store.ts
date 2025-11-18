import { defineStore } from "pinia";
import {HeroModel} from "../models/HeroModel.ts";
import {useUserStore} from "./user-store.ts";
import * as Request from '../api/Requests';
import type {IHero} from "../abstraction/IHero.ts";
import type TileModel from "../a-game-scenes/silesia-world-scene/models/tile-model.ts";

export const useHeroStore = defineStore("hero", {
    state: () => ({
        hero: new HeroModel() as HeroModel,
        inventoryShown: false,
        heroPositionsByMap: {} as Record<string, any>,
        flippedMy: true,
        heroMapTileBodyRotationAngle: 270,
        heroTargetRotation: 270
    }),

    actions: {
        async getHero(): Promise<boolean> {
            const userStore = useUserStore();
            const hero: IHero | null = await Request.getHero(userStore.user.getId());

            if (!hero) {
                console.warn("Hero is not retrieved by API");
                return false;
            }

            this.hero
                .setName(hero.name)
                .setMaxHealth(hero.maxHealth)
                .setHealth(hero.currentHealth)
                .setAttack(hero.attack)
                .setDefense(hero.defense)
                .setCoins(hero.coins)
                .setKills(hero.kills)
                .setCurrentEnergy(hero.currentEnergy)
                .setMaxEnergy(hero.maxEnergy)
                .setStats(hero.available)
                .setEquipment(hero.equipment)
                .setSteps(hero.heroSteps);

            return true;
        },

        getHeroCoinsAmount(): number {
            return this.hero.coins;
        },

        isAlive(): boolean {
            return this.hero.getHealth() > 0;
        },

        rest(): void {
            this.hero.healthIncreaser();
        },

        healHero(health: number): void {
            this.hero.currentHealth += health;
        },

        showInventory(status: boolean): void {
            this.inventoryShown = status;
        },

        setLocation(tile: TileModel): void {
            this.hero.heroLocation = tile.coordinates;
            this.hero.currentTile = tile;
        },

        pay(coins: number): void {
            this.hero.coins -= coins;
        },

        collect(coins: number): void {
            this.hero.coins += coins;
        },

        persistHeroLocation(): void {
            if (this.hero.heroLocation) {
                localStorage.setItem("hero-location", JSON.stringify(this.hero.heroLocation));
            }
        },

        resetHero(): void {
            console.log("Resetting hero state");
            this.hero = new HeroModel();
            this.heroPositionsByMap = {};
        },

        setTargetRotation(angle: number) {
            this.heroTargetRotation = angle;
        },
        tickRotation() {
            this.heroMapTileBodyRotationAngle +=
                (this.heroTargetRotation - this.heroMapTileBodyRotationAngle);
        }
    },
});