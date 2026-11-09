import { travelStepBudget } from '@hexoflat/engine/knowledge/math';
import type { WillZoneContext } from '@hexoflat/engine/knowledge/will-zone';
import type { StartHexActionCommand } from '@hexoflat/engine/commands/hex-engine-commands';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';
import type { KnowledgeAction } from '@hexoflat/engine/knowledge/commands';
import {
  dispatchHexAction,
  dispatchDevWillGrant,
  dispatchKnowledge,
  dispatchSkillSacrifice,
  dispatchSkillsReset,
  isAtKnowledgeBook,
  locationWillZone,
} from '@/services/knowledge/knowledge-controller';
import { defineStore } from 'pinia';
import { SHIELD_SLOTS } from '@/constants/shield-slots';
import type { SacrificeOptionId } from '@hexoflat/engine/skills/sacrifice-rules';
import type { SkillId } from '@hexoflat/engine/skills/skill-content';
import { getSkillBonuses } from '@hexoflat/engine/skills/skill-rules';
import { i18n } from '@/i18n';
import { HeroModel } from '@hexoflat/engine/models/hero-model';
import { fetchHero } from '../api/Requests';
import { ApiError } from '../api/client';
import { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { applyCommand, type HexEngineState } from '@hexoflat/engine';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import { isEnterableTile } from '@hexoflat/engine/hero-movement/move-planner';
import type { HeroState } from '@hexoflat/engine/hero-movement/hero-state';
import { portalLinkSchema, type PortalLink } from '@hexoflat/engine/portal/portal-state';
import {
  applyPortalClosedOnHost,
  closePortalForDeath,
  portalClosedEvents,
  portalLocation,
  type PortalClosedPayload,
} from '@/services/world/portal-service';
import { portalFxBusy } from '@/render/portal-fx';
import { executeMovementRoute } from '@/services/hero-movement/movement-executor';
import { readBlob, writeBlob } from '@/services/persistence/world-blob-store';
import { HERO_STORE_BLOB } from '@/stores/hero-store-blob';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import {
  bindKnowledgeListener,
  endPlayerSession,
  startPlayerSession,
} from '@/services/inventory/inventory-sync';
import { inventorySession } from '@/services/inventory/inventory-session';
import type { WorldCommandResult } from '@/services/inventory/inventory-sync';
import { buildClientHint } from '@/services/world/served-world';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useGameEventsStore } from '@/stores/game-events-store';
import { useBattleStore } from '@/stores/battle-store';
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

const HERO_NAV_KEY = 'nav';
const HERO_PROGRESS_KEY = 'progress';

export const useHeroStore = defineStore('hero', {
  state: () => ({
    hero: new HeroModel(),
    knowledge: null as KnowledgeState | null,
    knowledgeError: false,
    nav: defaultNav(),
    // Where the hero stands on the currently loaded map, and whether it is
    // mid-step. Persisted inside world-map-store's per-map state blob (the
    // same seam the battle snapshot uses) — see
    // world-map-store.ts's saveToStorage()/loadFromStorage().
    heroCoordinates: null as IHexCoordinates | null,
    isHeroMoving: false,
    extraShields: 0,
    portal: null as PortalLink | null,
  }),

  getters: {
    coins: () => useHeroInventoryStore().countItem(HEXOBJECT_KEYS.COINS),
    isAlive: (s) => s.hero.getHealth() > 0,
    heroHp: (s) => s.hero.currentHealth,
    heroHpMax: (s) => s.hero.getEffectiveMaxHealth(),
    skillBonuses: (s) => getSkillBonuses(s.knowledge?.skills ?? {}),
    willZoneContext(): WillZoneContext {
      return {
        willZone: locationWillZone(useWorldMapStore().currentLocationKey),
        combatActive: useBattleStore().inBattle,
      };
    },
  },

  actions: {
    loadKnowledge() {
      bindKnowledgeListener((knowledge) => {
        if (knowledge && knowledge.heroId === this.hero.id) this.knowledge = knowledge;
      });
      this.knowledge = inventorySession.knowledge;
      this.knowledgeError = !this.knowledge;
    },

    /** Where the hero stands, his health and the portal link come from the server's copy of his world. */
    restoreFromExpedition() {
      const raw = readBlob(HERO_STORE_BLOB);
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        if (saved && typeof saved === 'object') this.$patch(saved as never);
      } catch (error) {
        console.warn('Could not restore the hero from the saved expedition', error);
      }
    },

    knowledgeHost(world: ReturnType<typeof useWorldMapStore>) {
      const heroId = this.hero.id;
      const mapId = world.currentMapId;
      const combatActive = useBattleStore().inBattle;
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
        clientHint: () => buildClientHint(useHeroToolStore(), this.hero),
        applyWorldResult: (result: WorldCommandResult) => world.applyWorldResult(result),
        hero: this.engineHeroState(this.heroCoordinates ?? { columnIndex: 0, rowIndex: 0 }),
        location: portalLocation(world.currentLocationKey, world.currentMapId),
        isCurrent: () =>
          this.hero.id === heroId &&
          world.currentMapId === mapId &&
          useBattleStore().inBattle === combatActive,
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
      const state = await dispatchDevWillGrant(amount);
      if (heroId === this.hero.id && state) this.knowledge = state;
    },

    async sacrificeToSkill(skillId: SkillId, option: SacrificeOptionId): Promise<boolean> {
      const world = useWorldMapStore();
      if (!world.map || !this.knowledge || this.knowledgeError) return false;
      const heroId = this.hero.id;
      try {
        const result = await dispatchSkillSacrifice(
          { ...this.knowledgeHost(world), state: this.knowledge },
          skillId,
          option,
        );
        if (heroId !== this.hero.id) return false;
        this.knowledge = result.state;
        return result.accepted;
      } catch {
        this.knowledgeError = true;
        return false;
      }
    },

    async resetSkills(): Promise<boolean> {
      const world = useWorldMapStore();
      if (!world.map || !this.knowledge || this.knowledgeError) return false;
      const heroId = this.hero.id;
      try {
        const result = await dispatchSkillsReset({
          ...this.knowledgeHost(world),
          state: this.knowledge,
        });
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
        const battleStore = useBattleStore();
        const held = {
          battle: battleStore.battle ?? undefined,
          engagement: battleStore.engagement ?? undefined,
        };
        const result = await dispatchHexAction(this.knowledgeHost(world), command, held);
        if (result.held.engagement !== held.engagement) {
          battleStore.engage(result.held.engagement ?? null);
        }
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
      writeBlob(HERO_NAV_KEY, JSON.stringify(this.nav));
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
      writeBlob(HERO_PROGRESS_KEY, JSON.stringify(progress));
    },

    hydrateProgressFromStorage() {
      const raw = readBlob(HERO_PROGRESS_KEY);
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
        await startPlayerSession(hero.id);
        this.restoreFromExpedition();
        this.hero.id = hero.id;
        this.loadKnowledge();

        this.hero
          .setName(hero.name)
          .setMaxHealth(hero.maxHealth)
          .setHealth(hero.currentHealth)
          .setAttack(hero.attack)
          .setDefense(hero.defense)
          .setKills(hero.kills)
          .setCurrentEnergy(hero.currentEnergy)
          .setMaxEnergy(hero.maxEnergy)
          .setSteps(hero.heroSteps);

        this.hydrateProgressFromStorage();
        this.hero.setSteps(inventorySession.steps);

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

    resetHero(): void {
      console.log('Resetting hero state');
      this.hero = new HeroModel();
      this.knowledge = null;
      this.knowledgeError = false;
      this.extraShields = 0;
      this.portal = null;
      this.nav = defaultNav();
      bindKnowledgeListener(null);
      endPlayerSession();
      useHeroInventoryStore().reset();
      useHeroStashStore().reset();
    },

    /**
     * Free-roam movement goes through the engine's MOVE_HERO command, so the
     * route comes back as a domain event rather than being computed here.
     * Returns the route without the hero's current tile.
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
    ): { route: IHexCoordinates[] | null; affordable: boolean; ambush: Engagement | null } {
      const worldStore = useWorldMapStore();
      const battleStore = useBattleStore();
      const heroState = this.engineHeroState(this.heroCoordinates!);
      const planned: HexEngineState = {
        map,
        heroes: { [heroState.id]: heroState },
        battle: battleStore.battle ?? undefined,
        engagement: battleStore.engagement ?? undefined,
      };

      const { events } = applyCommand(
        planned,
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
      const ambush = events.some((e) => e.type === 'AMBUSH') ? (planned.engagement ?? null) : null;
      return { route: affordable ? route : null, affordable, ambush };
    },

    engageAmbush(engagement: Engagement) {
      useBattleStore().engage(engagement);
      useGameEventsStore().push(this.hero.name ?? 'Hero', i18n.global.t('squad.spotted'), 'BATTLE');
    },

    async moveHeroTo(target: IHexCoordinates): Promise<boolean> {
      const worldStore = useWorldMapStore();
      const heroToolStore = useHeroToolStore();
      const events = useGameEventsStore();
      const battleStore = useBattleStore();

      if (!worldStore.map || !this.heroCoordinates) return false;
      const warn = (message: string, icon: 'will' | null = null) => {
        heroToolStore.setActionMessage(message, icon);
        return false;
      };
      if (knowledgePanelMode.value) return warn(i18n.global.t('moveBlocked.panel'));
      if (portalFxBusy.value) return false;
      const stash = useHeroStashStore();
      if (stash.isOpen) {
        stash.close();
        heroToolStore.stopTool();
      }
      if (heroToolStore.isDragging) return false;
      if (this.isHeroMoving) return warn(i18n.global.t('moveBlocked.moving'));
      if (battleStore.inBattle) return warn(i18n.global.t('moveBlocked.inBattle'));

      const map = worldStore.map as HexMapModel;
      if (!isEnterableTile(map, target)) return warn(i18n.global.t('moveBlocked.blockedTile'));

      const plan = this.planFreeRoamRoute(map, target);
      const route = plan.route;
      if (!plan.affordable) return warn(i18n.global.t('moveBlocked.noWill'), 'will');
      if (!route) return warn(i18n.global.t('moveBlocked.tooFar'));

      let stepsTaken = 0;
      const ambushAt = plan.ambush ? route[route.length - 1] : null;

      if (heroToolStore.isLocked) {
        heroToolStore.cancelLockedAction('MOVE');
        worldStore.saveToStorage();
      }

      this.isHeroMoving = true;

      try {
        await executeMovementRoute(route, async (coord) => {
          const stepped = await worldStore.stepOnServer(coord);
          if (!stepped.ok) {
            const blocked = ['BLOCKED', 'INVALID_STEP', 'UNREACHABLE', 'NO_WORLD'];
            heroToolStore.setActionMessage(
              i18n.global.t(
                blocked.includes(stepped.code ?? '')
                  ? 'moveBlocked.blockedTile'
                  : 'moveBlocked.noWill',
              ),
              blocked.includes(stepped.code ?? '') ? null : 'will',
            );
            return false;
          }
          this.knowledge = inventorySession.knowledge;
          this.heroCoordinates = { ...coord };
          stepsTaken += 1;
          this.hero?.makeStep();
          this.saveProgressToStorage();

          const spotted =
            !!stepped.ambush ||
            (!!plan.ambush &&
              coord.columnIndex === ambushAt?.columnIndex &&
              coord.rowIndex === ambushAt.rowIndex);
          const engagement = stepped.ambush ?? plan.ambush;
          if (spotted && engagement) this.engageAmbush(engagement);
          worldStore.saveToStorage(undefined, { synced: true });

          if (worldStore.currentMapId && this.heroCoordinates) {
            this.rememberPosition(worldStore.currentMapId, this.heroCoordinates);
          }

          if (spotted) return false;
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
