import { defineStore } from 'pinia';
import { HeroModel } from '@hexoflat/engine/models/hero-model';
import { fetchHero } from '../api/Requests';
import { ApiError } from '../api/client';
import { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { applyCommand } from '@hexoflat/engine';
import { isEnterableTile, planCombatRoute } from '@hexoflat/engine/hero-movement/move-planner';
import { LOCAL_ACTOR_ID, newCommandId } from '@/services/world/engine-command';
import type { HeroState } from '@hexoflat/engine/hero-movement/hero-state';
import { executeMovementRoute } from '@/services/hero-movement/movement-executor';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useGameEventsStore } from '@/stores/game-events-store';
import { useCombatStore } from '@/stores/combat-store';
import { useWorldMapStore } from '@/stores/world-map-store';

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
    hero: new HeroModel(),
    nav: defaultNav(),
    // Where the hero stands on the currently loaded map, and whether it is
    // mid-step. Persisted inside world-map-store's per-map state blob (the
    // same seam combat-store's toSnapshot()/hydrate() already use) — see
    // world-map-store.ts's saveToStorage()/loadFromStorage().
    heroCoordinates: null as IHexCoordinates | null,
    isHeroMoving: false,
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
      try {
        const hero = await fetchHero();

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
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          console.warn('Hero is not retrieved by API');
        } else {
          console.error('Failed to fetch hero:', error);
        }
        return false;
      }
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

    /**
     * Free-roam movement goes through the engine's MOVE_HERO command, so the
     * route comes back as a domain event rather than being computed here.
     * Returns the route without the hero's current tile, matching
     * planCombatRoute.
     */
    planFreeRoamRoute(map: HexMapModel, target: IHexCoordinates): IHexCoordinates[] | null {
      const worldStore = useWorldMapStore();
      const heroState: HeroState = {
        id: this.hero.id,
        controlledBy: null,
        coordinates: this.heroCoordinates!,
        heroSteps: this.hero.heroSteps ?? 0,
      };

      const { events } = applyCommand(
        worldStore.buildEngineState(map, { [heroState.id]: heroState }),
        {
          commandId: newCommandId(),
          // The local session, not `heroState.id` — a fresh HeroModel has an
          // empty id, and the envelope's `min(1)` would reject the command.
          actorId: LOCAL_ACTOR_ID,
          type: 'MOVE_HERO',
          payload: { heroId: heroState.id, target },
        },
        worldStore.buildEngineContext(),
      );

      const moved = events.find((e) => e.type === 'HERO_MOVED') as
        { type: 'HERO_MOVED'; payload: { heroId: string; path: IHexCoordinates[] } } | undefined;

      return moved ? moved.payload.path.slice(1) : null;
    },

    /**
     * Moves the hero towards `target`: validates the destination and plans a
     * route (combat has a hard step budget; free roam goes through the
     * engine), then walks it one step at a time, reconciling map/combat
     * state as it goes. Needs the currently loaded map, so it reaches into
     * world-map-store rather than owning map data itself.
     */
    async moveHeroTo(target: IHexCoordinates): Promise<boolean> {
      const worldStore = useWorldMapStore();
      const heroToolStore = useHeroToolStore();
      const events = useGameEventsStore();
      const combatStore = useCombatStore();

      if (!worldStore.map || !this.heroCoordinates) return false;
      if (heroToolStore.isDragging || this.isHeroMoving) return false;
      if (combatStore.combatActive && combatStore.combatTurnSide !== 'hero') return false;
      if (combatStore.combatActive && combatStore.combatStepsLeft <= 0) return false;

      const map = worldStore.map as HexMapModel;
      if (!isEnterableTile(map, target)) return false;

      const route = combatStore.combatActive
        ? planCombatRoute(map, this.heroCoordinates, target, combatStore.combatStepsLeft)
        : this.planFreeRoamRoute(map, target);
      if (!route) return false;

      let stepsTaken = 0;

      if (heroToolStore.isLocked) {
        heroToolStore.cancelLockedAction('MOVE');
        worldStore.saveToStorage();
      }

      this.isHeroMoving = true;

      try {
        await executeMovementRoute(route, (coord) => {
          this.heroCoordinates = { ...coord };
          stepsTaken += 1;
          if (combatStore.combatActive) {
            combatStore.combatStepsLeft = Math.max(0, combatStore.combatStepsLeft - 1);
            combatStore.clearCombatAttackTrace();
          }
          this.hero?.makeStep();
          this.saveProgressToStorage();

          worldStore.revealAroundHero();
          if (combatStore.combatActive) {
            combatStore.syncEnemyAutoDefend();
          }
          worldStore.saveToStorage();

          if (worldStore.currentMapId && this.heroCoordinates) {
            this.rememberPosition(worldStore.currentMapId, this.heroCoordinates);
          }

          if (combatStore.combatActive && combatStore.combatStepsLeft <= 0) {
            return false;
          }
        });
      } finally {
        this.isHeroMoving = false;
      }

      events.push(
        this.hero?.name ?? 'Hero',
        `moved to [${this.heroCoordinates.columnIndex}, ${this.heroCoordinates.rowIndex}] by ${stepsTaken} step(s)`,
        'INFO',
      );

      return true;
    },
  },
});
