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

type HeroProgressState = {
    heroSteps: number;
    currentHealth: number;
    lastCampHealAt: number | null;
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
const HERO_PROGRESS_KEY = "hexoflat:heroProgress:v1";

export const useHeroStore = defineStore("hero", {
    state: () => ({
        hero: new HeroModel() as HeroModel,
        nav: defaultNav() as HeroNavState,
        lastCampHealAt: null as number | null,
    }),

    getters: {
        coins: (s) => s.hero.coins,
        isAlive: (s) => s.hero.getHealth() > 0,
        heroHp: (s) => s.hero.currentHealth,
        heroHpMax: (s) => s.hero.maxHealth,
    },

    actions: {
        saveNavToStorage() {
            localStorage.setItem(HERO_NAV_KEY, JSON.stringify(this.nav));
        },

        saveProgressToStorage() {
            const progress: HeroProgressState = {
                heroSteps: this.hero.heroSteps ?? 0,
                currentHealth: this.hero.currentHealth ?? this.hero.maxHealth ?? 100,
                lastCampHealAt: this.lastCampHealAt,
            };
            localStorage.setItem(HERO_PROGRESS_KEY, JSON.stringify(progress));
        },

        hydrateProgressFromStorage() {
            const raw = localStorage.getItem(HERO_PROGRESS_KEY);
            if (!raw) return;

            const progress = JSON.parse(raw) as Partial<HeroProgressState>;
            if (typeof progress.heroSteps === "number") {
                this.hero.setSteps(progress.heroSteps);
            }
            if (typeof progress.currentHealth === "number") {
                this.hero.setHealth(progress.currentHealth);
            }
            this.lastCampHealAt = typeof progress.lastCampHealAt === "number"
                ? progress.lastCampHealAt
                : null;
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

        forgetPosition(mapId: string) {
            delete this.nav.positionByMapId[mapId];
            if (this.nav.locationMapId === mapId) {
                this.nav.locationMapId = null;
            }
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

            this.hydrateProgressFromStorage();

            return true;
        },

        healHero(health: number): void {
            this.hero.setHealth((this.hero.currentHealth ?? 0) + health);
            this.hero.adjustHealthOnStatChange();
            this.saveProgressToStorage();
        },

        takeDamage(damage: number): void {
            this.hero.takeDamage(Math.max(0, damage));
            this.saveProgressToStorage();
        },

        markCampRecoveryStart(now = Date.now()): void {
            this.lastCampHealAt = now;
            this.saveProgressToStorage();
        },

        syncCampRecovery(now = Date.now()): boolean {
            if ((this.hero.currentHealth ?? 0) >= (this.hero.maxHealth ?? 100)) {
                return false;
            }

            const lastHealAt = this.lastCampHealAt ?? now;
            const elapsed = now - lastHealAt;
            const healTicks = Math.floor(elapsed / 10_000);

            if (healTicks < 1) {
                if (this.lastCampHealAt === null) {
                    this.lastCampHealAt = now;
                    this.saveProgressToStorage();
                }
                return false;
            }

            this.hero.setHealth(Math.min(
                this.hero.maxHealth ?? 100,
                (this.hero.currentHealth ?? 0) + healTicks
            ));
            this.lastCampHealAt = lastHealAt + healTicks * 10_000;
            this.saveProgressToStorage();
            return true;
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
            this.lastCampHealAt = null;
            localStorage.removeItem(HERO_NAV_KEY);
            localStorage.removeItem(HERO_PROGRESS_KEY);
        },
    },
});
