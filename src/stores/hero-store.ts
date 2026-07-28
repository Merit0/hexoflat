import { defineStore } from 'pinia';
import { HeroModel } from '@/models/hero-model';
import { useUserStore } from './user-store';
import * as Request from '../api/Requests';
import type { IHero } from '@/abstraction/hero-abstraction';
import { IHexCoordinates } from '@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface';
import { LocationKey } from '@/registry/world-map-registry';

type HeroNavState = {
  locationKey: LocationKey;
  locationMapId: string | null;
  positionByMapId: Record<string, IHexCoordinates>;
  returnStack: Array<{ locationKey: string; mapId: string }>;
};

type HeroProgressState = {
  heroSteps: number;
  currentHealth: number;
};

function defaultNav(): HeroNavState {
  return {
    locationKey: 'camping',
    locationMapId: null,
    positionByMapId: {},
    returnStack: [],
  };
}

const HERO_NAV_KEY = 'hexoflat:heroNav:v1';
const HERO_PROGRESS_KEY = 'hexoflat:heroProgress:v1';

export const useHeroStore = defineStore('hero', {
  state: () => ({
    hero: new HeroModel() as HeroModel,
    nav: defaultNav() as HeroNavState,
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
      };
      localStorage.setItem(HERO_PROGRESS_KEY, JSON.stringify(progress));
    },

    hydrateProgressFromStorage() {
      const raw = localStorage.getItem(HERO_PROGRESS_KEY);
      if (!raw) return;

      const progress = JSON.parse(raw) as Partial<HeroProgressState>;
      if (typeof progress.heroSteps === 'number') {
        this.hero.setSteps(progress.heroSteps);
      }
      if (typeof progress.currentHealth === 'number') {
        this.hero.setHealth(progress.currentHealth);
      }
    },

    setLocation(locationKey: LocationKey, mapId: string) {
      this.nav.locationKey = locationKey;
      this.nav.locationMapId = mapId;
      this.saveNavToStorage();
    },

    setPendingLocation(locationKey: LocationKey) {
      this.nav.locationKey = locationKey;
      this.nav.locationMapId = null;
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
      const hero: IHero | undefined = await Request.getHero(userStore.user.getId());

      if (!hero) {
        console.warn('Hero is not retrieved by API');
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

    reviveAtOneHp(): void {
      this.hero.setHealth(1);
      this.saveProgressToStorage();
    },

    pay(coins: number): void {
      this.hero.coins -= coins;
    },

    collect(coins: number): void {
      this.hero.coins += coins;
    },

    resetHero(): void {
      console.log('Resetting hero state');
      this.hero = new HeroModel();
      this.nav = defaultNav();
      localStorage.removeItem(HERO_NAV_KEY);
      localStorage.removeItem(HERO_PROGRESS_KEY);
    },
  },
});
