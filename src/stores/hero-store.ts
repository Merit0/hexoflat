import {defineStore} from "pinia";
import {HeroModel} from "@/models/hero-model";
import {useUserStore} from "./user-store";
import * as Request from "../api/Requests";
import type {IHero} from "@/abstraction/hero-abstraction";
import {IHexCoordinates} from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import {LocationKey} from "@/registry/world-map-registry";

type HeroNavState = {
    locationKey: LocationKey;
    locationMapId: string | null;
    positionByMapId: Record<string, IHexCoordinates>;
    returnStack: Array<{ locationKey: string; mapId: string }>;
};

function defaultNav(): HeroNavState {
    return {
        locationKey: "camping",
        locationMapId: null,
        positionByMapId: {},
        returnStack: [],
    };
}

const HERO_NAV_KEY = "hexoflat:heroNav:v1";

export const useHeroStore = defineStore("hero", {
    state: () => ({
        hero: new HeroModel() as HeroModel,
        nav: defaultNav() as HeroNavState,
    }),

    getters: {
        coins: (s) => s.hero.coins,
        isAlive: (s) => s.hero.getHealth() > 0,
    },

    actions: {
        saveNavToStorage() {
            localStorage.setItem(HERO_NAV_KEY, JSON.stringify(this.nav));
        },

        setLocation(locationKey: string, mapId: string) {
            this.nav.locationKey = locationKey;
            this.nav.locationMapId = mapId;
            this.saveNavToStorage();
        },

        rememberPosition(mapId: string, pos: IHexCoordinates) {
            this.nav.positionByMapId[mapId] = { ...pos };
            this.saveNavToStorage();
        },

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
            this.nav = defaultNav();
            localStorage.removeItem(HERO_NAV_KEY);
        },
    },
});