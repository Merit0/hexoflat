import {defineStore} from "pinia";
import {HeroModel} from "@/models/hero-model";
import {useUserStore} from "./user-store";
import * as Request from "../api/Requests";
import type {IHero} from "@/abstraction/hero-abstraction";

export const useHeroStore = defineStore("hero", {
    state: () => ({
        hero: new HeroModel() as HeroModel,
    }),

    getters: {
        coins: (s) => s.hero.coins,
        isAlive: (s) => s.hero.getHealth() > 0,
    },

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
                // .setEquipment(hero.equipment)
                .setSteps(hero.heroSteps);

            return true;
        },

        healHero(health: number): void {
            this.hero.currentHealth += health;
        },

        pay(coins: number): void {
            this.hero.coins -= coins;
        },

        collect(coins: number): void {
            this.hero.coins += coins;
        },

        resetHero(): void {
            console.log("Resetting hero state");
            this.hero = new HeroModel();
        },
    },
});