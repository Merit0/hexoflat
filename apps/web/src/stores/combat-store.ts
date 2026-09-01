import { defineStore } from 'pinia';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { getOddQNeighbors, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroStore } from '@/stores/hero-store';
import { useGameEventsStore } from '@/stores/game-events-store';
import { executeMovementRoute } from '@/services/hero-movement/movement-executor';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import { getToolCapabilities } from '@hexoflat/engine/game-resolvers/interactions-resolver';
import { normalizeHealthValue } from '@hexoflat/engine/utils/combat/health-format';
import { useWorldMapStore } from '@/stores/world-map-store';
import { i18n } from '@/i18n';
import {
  applyBlock,
  calculateEnemyRawDamage,
  calculateHeroRawDamage,
  getMarkerDefense,
} from '@hexoflat/engine/combat/damage-calculator';
import {
  canAttackTarget,
  canPlaceDefendMarkerOn,
  findEnemyTiles,
  findEnemyTilesSeeingHero,
  getCreatureOf,
  hasLivingEnemies,
  isAdjacentTo,
} from '@hexoflat/engine/combat/combat-rules';
import {
  findAttackOptions,
  findAutoDefendCoords,
  findRetreatOptions,
} from '@hexoflat/engine/combat/ai-controller';
import { pickRandom } from '@hexoflat/engine/utils/random';

// The hero's base swing when no attack stat is set on the hero model.
const DEFAULT_HERO_ATTACK = 8;

export type CombatTurnSide = 'hero' | 'enemy';
export type CombatActionMode = 'attack' | 'defend' | null;
export type CombatMarker = {
  owner: CombatTurnSide;
  coord: IHexCoordinates;
  kind: 'defend' | 'attack-trace';
  visible: boolean;
  toolKey?: THeroToolKey | null;
};

export type CombatSnapshot = {
  combatActive: boolean;
  combatTurnSide: CombatTurnSide;
  combatStepsLeft: number;
  combatStoredStepsBeforeDefend: number | null;
  combatTurnEndsAt: number | null;
  combatActionMode: CombatActionMode;
  combatAttackUsed: boolean;
  combatDefendUsed: boolean;
  combatMarkers: CombatMarker[];
};

function initialCombatTurnSide(): CombatTurnSide {
  return 'hero';
}

export const useCombatStore = defineStore('combat-store', {
  state: () => ({
    combatActive: false,
    combatTurnSide: initialCombatTurnSide(),
    combatStepsLeft: 0,
    combatStoredStepsBeforeDefend: null as number | null,
    combatTurnEndsAt: null as number | null,
    combatActionMode: null as CombatActionMode,
    combatAttackUsed: false,
    combatDefendUsed: false,
    combatMarkers: [] as CombatMarker[],
    isEnemyTurnResolving: false,
  }),

  actions: {
    // world-map-store.ts's saveToStorage()/loadFromStorage() persist combat
    // state in the same localStorage blob as the map (existing on-disk
    // format, not changed by this split) — these two are its read/write seam
    // into this store, with no side effects of their own.

    hydrate(snapshot: CombatSnapshot) {
      this.combatActive = snapshot.combatActive;
      this.combatTurnSide = snapshot.combatTurnSide;
      this.combatStepsLeft = snapshot.combatStepsLeft;
      this.combatStoredStepsBeforeDefend = snapshot.combatStoredStepsBeforeDefend;
      this.combatTurnEndsAt = snapshot.combatTurnEndsAt;
      this.combatActionMode = snapshot.combatActionMode;
      this.combatAttackUsed = snapshot.combatAttackUsed;
      this.combatDefendUsed = snapshot.combatDefendUsed;
      this.combatMarkers = snapshot.combatMarkers;
    },

    resetToDefaults() {
      this.hydrate({
        combatActive: false,
        combatTurnSide: 'hero',
        combatStepsLeft: 0,
        combatStoredStepsBeforeDefend: null,
        combatTurnEndsAt: null,
        combatActionMode: null,
        combatAttackUsed: false,
        combatDefendUsed: false,
        combatMarkers: [],
      });
    },

    toSnapshot(): CombatSnapshot {
      return {
        combatActive: this.combatActive,
        combatTurnSide: this.combatTurnSide,
        combatStepsLeft: this.combatStepsLeft,
        combatStoredStepsBeforeDefend: this.combatStoredStepsBeforeDefend,
        combatTurnEndsAt: this.combatTurnEndsAt,
        combatActionMode: this.combatActionMode,
        combatAttackUsed: this.combatAttackUsed,
        combatDefendUsed: this.combatDefendUsed,
        combatMarkers: this.combatMarkers.map((marker) => ({
          owner: marker.owner,
          coord: { ...marker.coord },
          kind: marker.kind,
          visible: marker.visible,
          toolKey: marker.toolKey ?? null,
        })),
      };
    },

    getCombatMoveBudget(): number {
      return 10;
    },

    getEnemyAttackDamage(enemyCoords?: IHexCoordinates | null) {
      if (!enemyCoords) return calculateEnemyRawDamage(null);
      const enemyTile = useWorldMapStore().getTileAt(enemyCoords);
      return calculateEnemyRawDamage(getCreatureOf(enemyTile?.hexobject)?.attack);
    },

    getCombatMarkerDefense(toolKey?: THeroToolKey | null) {
      return getMarkerDefense(toolKey);
    },

    getEnemyTilesSeeingHero(): HexTileModel[] {
      const worldStore = useWorldMapStore();
      const heroCoordinates = useHeroStore().heroCoordinates;
      if (!worldStore.map || !heroCoordinates) return [];

      return findEnemyTilesSeeingHero(worldStore.map as HexMapModel, heroCoordinates);
    },

    hasLivingEnemyCreatures() {
      const worldStore = useWorldMapStore();
      return worldStore.map ? hasLivingEnemies(worldStore.map as HexMapModel) : false;
    },

    getEnemyCombatActorTile(): HexTileModel | null {
      const worldStore = useWorldMapStore();
      const heroCoordinates = useHeroStore().heroCoordinates;
      if (!worldStore.map || !heroCoordinates) return null;

      return findEnemyTiles(worldStore.map as HexMapModel, heroCoordinates)[0] ?? null;
    },

    canPlaceCombatDefendMarker(target: IHexCoordinates): boolean {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();
      if (!this.combatActive) return false;
      if (this.combatTurnSide !== 'hero') return false;
      if (this.isEnemyTurnResolving || heroStore.isHeroMoving) return false;
      if (!worldStore.map || !heroStore.heroCoordinates) return false;
      if (this.combatDefendUsed) return false;

      return canPlaceDefendMarkerOn(
        worldStore.map as HexMapModel,
        heroStore.heroCoordinates,
        target,
      );
    },

    revealCombatVision() {
      const worldStore = useWorldMapStore();
      if (!worldStore.map) return;

      const enemies = this.getEnemyTilesSeeingHero();
      if (!enemies.length) return;

      for (const enemyTile of enemies) {
        const visionRange =
          enemyTile.hexobject?.groupType === EHexobjectGroup.CREATURE
            ? (enemyTile.hexobject.creature.visionRange ?? 3)
            : 3;

        for (const tile of worldStore.map.tiles) {
          if (hexDistance(enemyTile.coordinates, tile.coordinates) <= visionRange) {
            tile.isRevealed = true;
          }
        }
      }
    },

    startCombat() {
      if (this.combatActive) return;

      this.combatActive = true;
      this.revealCombatVision();
      this.beginCombatTurn('hero');
      useGameEventsStore().push('Combat', 'combat mode engaged', 'INFO');
    },

    endCombat() {
      this.combatActive = false;
      this.isEnemyTurnResolving = false;
      this.combatTurnSide = 'hero';
      this.combatStepsLeft = 0;
      this.combatStoredStepsBeforeDefend = null;
      this.combatTurnEndsAt = null;
      this.combatActionMode = null;
      this.combatAttackUsed = false;
      this.combatDefendUsed = false;
      this.combatMarkers = [];
    },

    beginCombatTurn(side: CombatTurnSide) {
      this.combatTurnSide = side;
      this.combatStepsLeft = this.getCombatMoveBudget();
      this.combatStoredStepsBeforeDefend = null;
      this.combatTurnEndsAt = Date.now() + 30_000;
      this.combatActionMode = null;
      this.combatAttackUsed = false;
      this.combatDefendUsed = false;
      this.combatMarkers = this.combatMarkers.filter((marker) => marker.owner !== side);
      this.clearCombatAttackTrace();

      useGameEventsStore().push('Combat', `${side} turn started`, 'INFO');

      if (side === 'hero') {
        this.syncEnemyAutoDefend();
      }

      if (side === 'enemy') {
        void this.ensureEnemyTurnResolution();
      }
    },

    advanceCombatTurn() {
      if (!this.combatActive) return;
      if (this.isEnemyTurnResolving) return;

      const nextSide: CombatTurnSide = this.combatTurnSide === 'hero' ? 'enemy' : 'hero';
      this.beginCombatTurn(nextSide);
    },

    beginCombatAction(mode: Exclude<CombatActionMode, null>) {
      if (!this.combatActive) return;
      if (this.combatTurnSide !== 'hero') return;
      if (this.isEnemyTurnResolving || useHeroStore().isHeroMoving) return;
      if (mode === 'attack' && this.combatAttackUsed) return;
      if (mode === 'defend' && this.combatDefendUsed) return;
      this.combatActionMode = this.combatActionMode === mode ? null : mode;
    },

    cancelCombatAction() {
      this.combatActionMode = null;
    },

    revealCombatMarkers(owner: CombatTurnSide, kind: CombatMarker['kind'] = 'defend') {
      let changed = false;

      this.combatMarkers = this.combatMarkers.map((marker) => {
        if (marker.owner !== owner || marker.kind !== kind || marker.visible) {
          return marker;
        }

        changed = true;
        return {
          ...marker,
          visible: true,
        };
      });

      if (changed) {
      }
    },

    clearCombatAttackTrace() {
      const nextMarkers = this.combatMarkers.filter((marker) => marker.kind !== 'attack-trace');
      if (nextMarkers.length === this.combatMarkers.length) return;

      this.combatMarkers = nextMarkers;
    },

    placeCombatDefendMarker(target: IHexCoordinates, toolKey?: THeroToolKey | null): boolean {
      if (!this.canPlaceCombatDefendMarker(target)) return false;

      const capabilities = toolKey ? getToolCapabilities(toolKey) : {};
      if (!capabilities.canBlock) return false;

      this.combatMarkers = this.combatMarkers.filter((marker) => {
        if (marker.owner !== 'hero') return true;

        return (
          marker.coord.columnIndex !== target.columnIndex ||
          marker.coord.rowIndex !== target.rowIndex
        );
      });

      this.combatMarkers.push({
        owner: 'hero',
        coord: { ...target },
        kind: 'defend',
        visible: true,
        toolKey: toolKey ?? null,
      });

      this.combatDefendUsed = true;
      this.combatStoredStepsBeforeDefend = this.combatStepsLeft;
      this.combatStepsLeft = 0;
      this.combatActionMode = null;
      useGameEventsStore().push('Combat', 'hero placed shield', 'INFO');
      return true;
    },

    removeCombatDefendMarker(target: IHexCoordinates): boolean {
      if (!this.combatActive) return false;
      if (this.combatTurnSide !== 'hero') return false;
      if (this.isEnemyTurnResolving || useHeroStore().isHeroMoving) return false;

      const marker = this.combatMarkers.find(
        (item) =>
          item.owner === 'hero' &&
          item.kind === 'defend' &&
          item.coord.columnIndex === target.columnIndex &&
          item.coord.rowIndex === target.rowIndex,
      );
      if (!marker) return false;

      this.combatMarkers = this.combatMarkers.filter((item) => item !== marker);
      this.combatDefendUsed = false;
      this.combatStepsLeft = this.combatStoredStepsBeforeDefend ?? this.combatStepsLeft;
      this.combatStoredStepsBeforeDefend = null;
      this.combatActionMode = null;
      useGameEventsStore().push('Combat', 'hero removed shield', 'INFO');
      return true;
    },

    syncEnemyAutoDefend() {
      const worldStore = useWorldMapStore();
      const heroCoordinates = useHeroStore().heroCoordinates;
      if (
        !this.combatActive ||
        this.combatTurnSide !== 'hero' ||
        !worldStore.map ||
        !heroCoordinates
      )
        return;

      const adjacentEnemies = getOddQNeighbors(heroCoordinates)
        .map((coord) => worldStore.getTileAt(coord))
        .filter((tile): tile is HexTileModel => !!tile)
        .filter((tile) => {
          const obj = tile.hexobject;
          return obj?.groupType === EHexobjectGroup.CREATURE && obj.creature.faction === 'enemy';
        });

      if (!adjacentEnemies.length) return;

      const alreadyHasEnemyShield = this.combatMarkers.some(
        (marker) => marker.owner === 'enemy' && marker.kind === 'defend',
      );
      if (alreadyHasEnemyShield) return;

      const chosen = pickRandom(
        findAutoDefendCoords(worldStore.map as HexMapModel, adjacentEnemies[0].coordinates),
        useWorldMapStore().rng('combat'),
      );
      if (!chosen) return;

      this.combatMarkers.push({
        owner: 'enemy',
        coord: { ...chosen },
        kind: 'defend',
        visible: false,
        toolKey: HEXOBJECT_KEYS.SHIELD,
      });

      useGameEventsStore().push('Combat', 'enemy auto-raised shield', 'INFO');
    },

    async moveEnemyAlongRoute(enemyTile: HexTileModel, route: IHexCoordinates[]) {
      const worldStore = useWorldMapStore();
      if (!route.length || !enemyTile.hexobject) return enemyTile;

      let currentTile = enemyTile;
      const enemyObject = enemyTile.hexobject;

      await executeMovementRoute(route, (coord) => {
        const nextTile = worldStore.getTileAt(coord);
        if (!nextTile || nextTile === currentTile) return;

        currentTile.hexobject = null;
        nextTile.hexobject = enemyObject;
        currentTile = nextTile;
        this.combatStepsLeft = Math.max(0, this.combatStepsLeft - 1);
        this.clearCombatAttackTrace();
        worldStore.revealAroundHero();
      });

      return currentTile;
    },

    async ensureEnemyTurnResolution() {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();
      const events = useGameEventsStore();

      const heroCoordinates = heroStore.heroCoordinates;
      if (
        !this.combatActive ||
        this.combatTurnSide !== 'enemy' ||
        !worldStore.map ||
        !heroCoordinates
      )
        return;
      if (this.isEnemyTurnResolving || heroStore.isHeroMoving) return;

      const map = worldStore.map as HexMapModel;
      const enemyTile = this.getEnemyCombatActorTile();
      if (!enemyTile?.hexobject) {
        this.advanceCombatTurn();
        return;
      }

      this.isEnemyTurnResolving = true;

      try {
        const chosenAttack = pickRandom(
          findAttackOptions(map, enemyTile.coordinates, heroCoordinates, this.combatStepsLeft),
          useWorldMapStore().rng('combat'),
        );

        if (!chosenAttack) {
          this.combatStepsLeft = 0;
          return;
        }

        let currentEnemyTile = await this.moveEnemyAlongRoute(enemyTile, chosenAttack.route);

        await new Promise((resolve) => window.setTimeout(resolve, 5_000));

        const blockingMarker = this.combatMarkers.find(
          (marker) =>
            marker.owner === 'hero' &&
            marker.kind === 'defend' &&
            marker.coord.columnIndex === chosenAttack.coord.columnIndex &&
            marker.coord.rowIndex === chosenAttack.coord.rowIndex,
        );

        this.combatMarkers = this.combatMarkers.filter(
          (marker) => !(marker.owner === 'enemy' && marker.kind === 'attack-trace'),
        );
        this.combatMarkers.push({
          owner: 'enemy',
          coord: { ...currentEnemyTile.coordinates },
          kind: 'attack-trace',
          visible: true,
          toolKey: null,
        });
        this.revealCombatMarkers('hero');

        const rawDamage = this.getEnemyAttackDamage(currentEnemyTile.coordinates);
        const blockDefense = blockingMarker ? getMarkerDefense(blockingMarker.toolKey) : 0;
        const finalDamage = applyBlock(rawDamage, blockDefense);

        if (blockingMarker && finalDamage <= 0) {
          events.push(
            'Combat',
            `${getCreatureOf(currentEnemyTile.hexobject)?.name ?? 'Enemy'} blocked by shield [dmg:0]`,
            'BATTLE',
          );
        } else {
          heroStore.takeDamage(finalDamage);
          if (blockingMarker) {
            events.push(
              getCreatureOf(currentEnemyTile.hexobject)?.name ?? 'Enemy',
              `broke through block for [dmg:${finalDamage.toFixed(1)}]`,
              'BATTLE',
            );
          } else {
            events.push(
              getCreatureOf(currentEnemyTile.hexobject)?.name ?? 'Enemy',
              `hit ${heroStore.hero?.name ?? 'Hero'} for [dmg:${finalDamage.toFixed(1)}]`,
              'BATTLE',
            );
          }

          if ((heroStore.hero.currentHealth ?? 0) <= 0) {
            await worldStore.respawnHeroAtCamping();
            return;
          }
        }

        const chosenRetreat =
          this.combatStepsLeft > 0
            ? pickRandom(
                findRetreatOptions(
                  map,
                  currentEnemyTile.coordinates,
                  heroCoordinates,
                  this.combatStepsLeft,
                ),
                useWorldMapStore().rng('combat'),
              )
            : null;

        if (chosenRetreat) {
          currentEnemyTile = await this.moveEnemyAlongRoute(currentEnemyTile, chosenRetreat.route);
          events.push(
            'Combat',
            `${getCreatureOf(currentEnemyTile.hexobject)?.name ?? 'Enemy'} retreated`,
            'INFO',
          );
        }

        this.combatStepsLeft = 0;
      } finally {
        this.isEnemyTurnResolving = false;

        if (this.combatActive && this.combatTurnSide === 'enemy') {
          this.advanceCombatTurn();
        }
      }
    },

    performHeroCombatAttack(
      target: HexTileModel,
      toolKey: string,
    ): { ok: boolean; message: string } {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();

      if (!this.combatActive) return { ok: false, message: 'Combat is not active.' };
      if (this.combatTurnSide !== 'hero') return { ok: false, message: 'Not hero turn.' };
      if (this.isEnemyTurnResolving || heroStore.isHeroMoving)
        return { ok: false, message: 'Wait until enemy turn finishes.' };
      if (this.combatAttackUsed) return { ok: false, message: 'Attack already used this turn.' };
      const capabilities = getToolCapabilities(toolKey as THeroToolKey);
      if (!capabilities.canAttack) return { ok: false, message: 'Need a weapon to attack.' };
      const heroCoordinates = heroStore.heroCoordinates;
      if (!heroCoordinates) return { ok: false, message: 'Hero position is missing.' };

      if (!isAdjacentTo(heroCoordinates, target.coordinates)) {
        return { ok: false, message: 'Target is not adjacent.' };
      }
      const creature = canAttackTarget(heroCoordinates, target)
        ? getCreatureOf(target.hexobject)
        : undefined;
      if (!creature) return { ok: false, message: 'Target is not an enemy creature.' };

      const targetKey = target.hexobject!.hexobjectKey;

      const blockingMarker = this.combatMarkers.find(
        (marker) =>
          marker.owner === 'enemy' &&
          marker.kind === 'defend' &&
          marker.coord.columnIndex === heroCoordinates.columnIndex &&
          marker.coord.rowIndex === heroCoordinates.rowIndex,
      );

      this.combatAttackUsed = true;
      this.combatActionMode = null;
      this.revealCombatMarkers('enemy');

      const rawDamage = calculateHeroRawDamage(
        heroStore.hero?.attack ?? DEFAULT_HERO_ATTACK,
        toolKey as THexobjectKey,
      );
      const blockDefense = blockingMarker ? getMarkerDefense(blockingMarker.toolKey) : 0;
      const damage = applyBlock(rawDamage, blockDefense);

      const creatureName = i18n.global.t(creature.name);

      if (blockingMarker && damage <= 0) {
        useGameEventsStore().push('Combat', `${creatureName} blocked the hit [dmg:0]`, 'BATTLE');
        return { ok: true, message: 'Attack was blocked.' };
      }

      creature.hp = normalizeHealthValue(creature.hp - damage);
      if (blockingMarker) {
        useGameEventsStore().push(
          heroStore.hero?.name ?? 'Hero',
          `broke through block for [dmg:${damage.toFixed(1)}]`,
          'BATTLE',
        );
      } else {
        useGameEventsStore().push(
          heroStore.hero?.name ?? 'Hero',
          `hit ${creatureName} for [dmg:${damage.toFixed(1)}]`,
          'BATTLE',
        );
      }

      if (creature.hp <= 0) {
        target.hexobject =
          worldStore.currentLocationKey === 'cave' && targetKey === HEXOBJECT_KEYS.SKELETOR
            ? HexObjectFactory.create(HEXOBJECT_KEYS.GRAVE, target.coordinates)
            : null;
        heroStore.hero?.addKilled();
        useGameEventsStore().push('Combat', `${creatureName} was defeated`, 'INFO');
      }

      if (!this.hasLivingEnemyCreatures()) {
        this.endCombat();
        useGameEventsStore().push('Combat', 'area cleared', 'INFO');
      }

      return { ok: true, message: 'Attack landed.' };
    },
  },
});
