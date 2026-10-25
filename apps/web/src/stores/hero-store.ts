import { travelStepBudget } from '@hexoflat/engine/knowledge/math';
import { willZoneCharges, type WillZoneContext } from '@hexoflat/engine/knowledge/will-zone';
import type { StartHexActionCommand } from '@hexoflat/engine/commands/hex-engine-commands';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';
import type { KnowledgeAction } from '@hexoflat/engine/knowledge/commands';
import { readKnowledge } from '@/services/persistence/knowledge-storage';
import {
  dispatchHexAction,
  dispatchDevWillGrant,
  dispatchKnowledge,
  dispatchSkillUnlock,
  isAtKnowledgeBook,
  locationWillZone,
} from '@/services/knowledge/knowledge-controller';
import { defineStore } from 'pinia';
import { SHIELD_SLOTS } from '@/constants/shield-slots';
import type { SkillId } from '@hexoflat/engine/skills/skill-content';
import { getSkillBonuses } from '@hexoflat/engine/skills/skill-rules';
import { i18n } from '@/i18n';
import { HeroModel } from '@hexoflat/engine/models/hero-model';
import { fetchHero } from '../api/Requests';
import { ApiError } from '../api/client';
import { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { applyCommand } from '@hexoflat/engine';
import { isEnterableTile, planCombatRoute } from '@hexoflat/engine/hero-movement/move-planner';
import type { HeroState } from '@hexoflat/engine/hero-movement/hero-state';
import { portalLinkSchema, type PortalLink } from '@hexoflat/engine/portal/portal-state';
import {
  applyPortalClosedOnHost,
  closePortalForDeath,
  portalClosedEvents,
  portalLocation,
  type PortalClosedPayload,
} from '@/services/world/portal-service';
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
  healthBonus: number;
  extraShields: number;
  portal?: PortalLink | null;
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
    knowledge: null as KnowledgeState | null,
    knowledgeError: false,
    nav: defaultNav(),
    // Where the hero stands on the currently loaded map, and whether it is
    // mid-step. Persisted inside world-map-store's per-map state blob (the
    // same seam combat-store's toSnapshot()/hydrate() already use) — see
    // world-map-store.ts's saveToStorage()/loadFromStorage().
    heroCoordinates: null as IHexCoordinates | null,
    isHeroMoving: false,
    extraShields: 0,
    portal: null as PortalLink | null,
  }),

  getters: {
    coins: (s) => s.hero.coins,
    isAlive: (s) => s.hero.getHealth() > 0,
    heroHp: (s) => s.hero.currentHealth,
    heroHpMax: (s) => s.hero.getEffectiveMaxHealth(),
    skillBonuses: (s) => getSkillBonuses(s.knowledge?.skills ?? {}),
    willZoneContext(): WillZoneContext {
      return {
        willZone: locationWillZone(useWorldMapStore().currentLocationKey),
        combatActive: useCombatStore().combatActive,
      };
    },
  },

  actions: {
    loadKnowledge() {
      try {
        this.knowledge = readKnowledge(this.hero.id);
        this.knowledgeError = false;
      } catch {
        this.knowledge = null;
        this.knowledgeError = true;
      }
    },

    knowledgeHost(world: ReturnType<typeof useWorldMapStore>) {
      const heroId = this.hero.id;
      const mapId = world.currentMapId;
      const combatActive = useCombatStore().combatActive;
      return {
        heroId,
        map: world.map as HexMapModel,
        context: {
          locationKey: world.currentLocationKey,
          willZone: locationWillZone(world.currentLocationKey),
          mapId: world.currentMapId ?? '',
          combatActive,
          moving: this.isHeroMoving,
          coordinates: this.heroCoordinates ?? undefined,
          atBook: isAtKnowledgeBook(world.map as HexMapModel, this.heroCoordinates),
        },
        engineContext: world.buildEngineContext(),
        hero: this.engineHeroState(this.heroCoordinates ?? { columnIndex: 0, rowIndex: 0 }),
        location: portalLocation(world.currentLocationKey, world.currentMapId),
        isCurrent: () =>
          this.hero.id === heroId &&
          world.currentMapId === mapId &&
          useCombatStore().combatActive === combatActive,
      };
    },

    async knowledgeAction(action: KnowledgeAction): Promise<boolean> {
      const world = useWorldMapStore();
      if (!world.map || !this.knowledge || this.knowledgeError) return false;
      const heroId = this.hero.id;
      try {
        const result = await dispatchKnowledge(
          { ...this.knowledgeHost(world), state: this.knowledge },
          action,
        );
        if (heroId !== this.hero.id) return false;
        this.knowledge = result.state;
        return result.accepted;
      } catch {
        this.knowledgeError = true;
        return false;
      }
    },

    setMaxHealthBonus(bonus: number): void {
      this.hero.setMaxHealthBonus(bonus);
      this.saveProgressToStorage();
    },

    devAddShield(): void {
      if (!import.meta.env.DEV) return;
      this.extraShields = Math.min(SHIELD_SLOTS, this.extraShields + 1);
      this.saveProgressToStorage();
    },

    async devGrantWill(amount: number): Promise<void> {
      if (!import.meta.env.DEV || !this.knowledge) return;
      const heroId = this.hero.id;
      const state = await dispatchDevWillGrant(heroId, amount);
      if (heroId === this.hero.id) this.knowledge = state;
    },

    async unlockSkill(skillId: SkillId): Promise<boolean> {
      const world = useWorldMapStore();
      if (!world.map || !this.knowledge || this.knowledgeError) return false;
      const heroId = this.hero.id;
      try {
        const result = await dispatchSkillUnlock(
          { ...this.knowledgeHost(world), state: this.knowledge },
          skillId,
        );
        if (heroId !== this.hero.id) return false;
        this.knowledge = result.state;
        return result.accepted;
      } catch {
        this.knowledgeError = true;
        return false;
      }
    },

    async startHexAction(command: StartHexActionCommand) {
      const world = useWorldMapStore();
      if (!world.map || this.knowledgeError) return null;
      const heroId = this.hero.id;
      try {
        const result = await dispatchHexAction(this.knowledgeHost(world), command);
        if (heroId === this.hero.id) {
          this.knowledge = result.state;
          this.setPortal(result.hero.portal ?? null);
        }
        this.applyPortalClosures(portalClosedEvents(result.events));
        return result.events;
      } catch {
        this.knowledgeError = true;
        return null;
      }
    },

    saveNavToStorage() {
      localStorage.setItem(HERO_NAV_KEY, JSON.stringify(this.nav));
    },

    applyPortalClosures(closures: PortalClosedPayload[]) {
      const world = useWorldMapStore();
      applyPortalClosedOnHost(world, world.map as HexMapModel | null, closures);
    },

    closePortalOnDeath() {
      const world = useWorldMapStore();
      const hero = this.engineHeroState(this.heroCoordinates ?? { columnIndex: 0, rowIndex: 0 });
      if (closePortalForDeath(world, world.map as HexMapModel | null, hero)) this.setPortal(null);
    },

    setPortal(portal: PortalLink | null) {
      this.portal = portal;
      this.saveProgressToStorage();
    },

    saveProgressToStorage() {
      const progress: HeroProgressState = {
        heroSteps: this.hero.heroSteps ?? 0,
        currentHealth: this.hero.currentHealth ?? this.hero.maxHealth ?? 100,
        healthBonus: this.hero.maxHealthBonus,
        extraShields: this.extraShields,
        portal: this.portal,
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
      if (typeof progress.healthBonus === 'number') {
        this.hero.maxHealthBonus = progress.healthBonus;
      }
      if (typeof progress.extraShields === 'number') {
        this.extraShields = progress.extraShields;
      }
      const portal = portalLinkSchema.safeParse(progress.portal);
      this.portal = portal.success ? portal.data : null;
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

        this.hero.id = hero.id;
        this.loadKnowledge();

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
      this.knowledge = null;
      this.knowledgeError = false;
      this.extraShields = 0;
      this.portal = null;
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
    engineHeroState(coordinates: IHexCoordinates): HeroState {
      return {
        id: this.hero.id,
        controlledBy: null,
        coordinates: { ...coordinates },
        heroSteps: this.hero.heroSteps ?? 0,
        portal: this.portal,
      };
    },

    planFreeRoamRoute(
      map: HexMapModel,
      target: IHexCoordinates,
    ): { route: IHexCoordinates[] | null; affordable: boolean } {
      const worldStore = useWorldMapStore();
      const heroState = this.engineHeroState(this.heroCoordinates!);

      const { events } = applyCommand(
        { map, heroes: { [heroState.id]: heroState } },
        { type: 'MOVE_HERO', payload: { heroId: heroState.id, target } },
        worldStore.buildEngineContext(),
      );

      const moved = events.find((e) => e.type === 'HERO_MOVED') as
        { type: 'HERO_MOVED'; payload: { heroId: string; path: IHexCoordinates[] } } | undefined;

      const route = moved?.payload.path.slice(1) ?? null;
      const budget = travelStepBudget(
        route?.length ?? 0,
        this.knowledge?.current ?? 0,
        this.willZoneContext,
      );
      const affordable = !route || route.length <= budget;
      return { route: affordable ? route : null, affordable };
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
      const warn = (message: string) => {
        heroToolStore.setActionMessage(message);
        return false;
      };
      if (knowledgePanelMode.value) return warn(i18n.global.t('moveBlocked.panel'));
      if (this.knowledge?.session?.status === 'returning')
        return warn(i18n.global.t('moveBlocked.returning'));
      if (heroToolStore.isDragging) return false;
      if (this.isHeroMoving) return warn(i18n.global.t('moveBlocked.moving'));
      if (combatStore.combatActive && combatStore.combatTurnSide !== 'hero')
        return warn(i18n.global.t('moveBlocked.notYourTurn'));
      if (combatStore.combatActive && combatStore.combatStepsLeft <= 0)
        return warn(i18n.global.t('moveBlocked.noSteps'));

      const map = worldStore.map as HexMapModel;
      if (!isEnterableTile(map, target)) return warn(i18n.global.t('moveBlocked.blockedTile'));

      let route: IHexCoordinates[] | null;
      if (combatStore.combatActive) {
        route = planCombatRoute(map, this.heroCoordinates, target, combatStore.combatStepsLeft);
        if (!route) return warn(i18n.global.t('moveBlocked.tooFar'));
      } else {
        const plan = this.planFreeRoamRoute(map, target);
        route = plan.route;
        if (!plan.affordable) return warn(i18n.global.t('moveBlocked.noWill'));
        if (!route) return warn(i18n.global.t('moveBlocked.tooFar'));
      }

      let stepsTaken = 0;

      if (heroToolStore.isLocked) {
        heroToolStore.cancelLockedAction('MOVE');
        worldStore.saveToStorage();
      }

      this.isHeroMoving = true;

      try {
        await executeMovementRoute(route, async (coord) => {
          if (willZoneCharges(this.willZoneContext)) {
            if (!(await this.knowledgeAction({ kind: 'step', target: coord }))) {
              heroToolStore.setActionMessage(i18n.global.t('moveBlocked.noWill'));
              return false;
            }
          }
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

      return stepsTaken > 0;
    },
  },
});
