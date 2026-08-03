import { defineStore } from 'pinia';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import { getOddQNeighbors, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import {
  EHexCollision,
  EHexobjectGroup,
  type ICreature,
  type THexobject,
} from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroStore } from '@/stores/hero-store';
import { useGameEventsStore } from '@/stores/game-events-store';
import { findShortestPath } from '@hexoflat/engine/hero-movement/pathfinding-service';
import { executeMovementRoute } from '@/services/hero-movement/movement-executor';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import { getToolCapabilities } from '@hexoflat/engine/game-resolvers/interactions-resolver';
import { getPrototype } from '@hexoflat/engine';
import { normalizeHealthValue } from '@hexoflat/engine/utils/combat/health-format';
import { useWorldMapStore } from '@/stores/world-map-store';

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

function getCreatureOf(hexobject: THexobject | null | undefined): ICreature | undefined {
  return hexobject?.groupType === EHexobjectGroup.CREATURE ? hexobject.creature : undefined;
}

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
    // ======================================================
    // PERSISTENCE BRIDGE
    // ======================================================
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

    // ======================================================
    // QUERIES
    // ======================================================

    getCombatMoveBudget(): number {
      return 10;
    },

    getEnemyAttackDamage(enemyCoords?: IHexCoordinates | null) {
      if (!enemyCoords) return 1;
      const worldStore = useWorldMapStore();
      const enemyTile = worldStore.getTileAt(enemyCoords);
      if (enemyTile?.hexobject?.groupType !== EHexobjectGroup.CREATURE) return 1;
      return enemyTile.hexobject.creature.attack ?? 1;
    },

    getCombatMarkerDefense(toolKey?: THeroToolKey | null) {
      if (!toolKey) return 0;

      const proto = getPrototype(toolKey);
      if (!proto) return 0;

      if (proto.groupType === EHexobjectGroup.EQUIPMENT) {
        return Math.max(0, Number(proto.equipment.defense ?? 0));
      }

      if (proto.groupType === EHexobjectGroup.TOOL) {
        return Math.max(0, Number(proto.tool.defense ?? 0));
      }

      return 0;
    },

    getEnemyTilesSeeingHero(): HexTileModel[] {
      const worldStore = useWorldMapStore();
      if (!worldStore.map || !worldStore.heroCoordinates) return [];

      return worldStore.map.tiles
        .filter((tile): tile is HexTileModel => !!tile?.hexobject)
        .filter((tile) => tile.hexobject?.groupType === EHexobjectGroup.CREATURE)
        .filter((tile) => getCreatureOf(tile.hexobject)?.faction === 'enemy')
        .filter((tile) => {
          const visionRange = getCreatureOf(tile.hexobject)?.visionRange ?? 3;
          return hexDistance(tile.coordinates, worldStore.heroCoordinates!) <= visionRange;
        });
    },

    hasLivingEnemyCreatures() {
      const worldStore = useWorldMapStore();
      if (!worldStore.map) return false;

      return worldStore.map.tiles.some(
        (tile) =>
          tile.hexobject?.groupType === EHexobjectGroup.CREATURE &&
          tile.hexobject.creature?.faction === 'enemy',
      );
    },

    getEnemyCombatActorTile(): HexTileModel | null {
      const worldStore = useWorldMapStore();
      if (!worldStore.map || !worldStore.heroCoordinates) return null;

      const enemyTiles = worldStore.map.tiles
        .filter((tile): tile is HexTileModel => !!tile.hexobject)
        .filter((tile) => {
          const obj = tile.hexobject;
          return obj?.groupType === EHexobjectGroup.CREATURE && obj.creature.faction === 'enemy';
        })
        .sort(
          (a, b) =>
            hexDistance(a.coordinates, worldStore.heroCoordinates!) -
            hexDistance(b.coordinates, worldStore.heroCoordinates!),
        );

      return enemyTiles[0] ?? null;
    },

    canPlaceCombatDefendMarker(target: IHexCoordinates): boolean {
      const worldStore = useWorldMapStore();
      if (!this.combatActive) return false;
      if (this.combatTurnSide !== 'hero') return false;
      if (this.isEnemyTurnResolving || worldStore.isHeroMoving) return false;
      if (!worldStore.heroCoordinates) return false;
      if (this.combatDefendUsed) return false;

      const isAdjacent = getOddQNeighbors(worldStore.heroCoordinates).some(
        (n) => n.columnIndex === target.columnIndex && n.rowIndex === target.rowIndex,
      );
      if (!isAdjacent) return false;

      const tile = worldStore.getTileAt(target);
      if (!tile || !tile.isRevealed) return false;
      if (tile.hexobject?.collision === EHexCollision.SOLID) return false;
      if (tile.hexobject) return false;

      return true;
    },

    // ======================================================
    // VISION
    // ======================================================

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

    // ======================================================
    // TURN FLOW
    // ======================================================

    startCombat() {
      if (this.combatActive) return;

      this.combatActive = true;
      this.revealCombatVision();
      this.beginCombatTurn('hero');
      useWorldMapStore().saveToStorage();
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
      useWorldMapStore().saveToStorage();
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

      useWorldMapStore().saveToStorage();

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
      const worldStore = useWorldMapStore();
      if (!this.combatActive) return;
      if (this.combatTurnSide !== 'hero') return;
      if (this.isEnemyTurnResolving || worldStore.isHeroMoving) return;
      if (mode === 'attack' && this.combatAttackUsed) return;
      if (mode === 'defend' && this.combatDefendUsed) return;
      this.combatActionMode = this.combatActionMode === mode ? null : mode;
      worldStore.saveToStorage();
    },

    cancelCombatAction() {
      this.combatActionMode = null;
      useWorldMapStore().saveToStorage();
    },

    // ======================================================
    // MARKERS
    // ======================================================

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
        useWorldMapStore().saveToStorage();
      }
    },

    clearCombatAttackTrace() {
      const nextMarkers = this.combatMarkers.filter((marker) => marker.kind !== 'attack-trace');
      if (nextMarkers.length === this.combatMarkers.length) return;

      this.combatMarkers = nextMarkers;
      useWorldMapStore().saveToStorage();
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
      useWorldMapStore().saveToStorage();
      return true;
    },

    removeCombatDefendMarker(target: IHexCoordinates): boolean {
      const worldStore = useWorldMapStore();
      if (!this.combatActive) return false;
      if (this.combatTurnSide !== 'hero') return false;
      if (this.isEnemyTurnResolving || worldStore.isHeroMoving) return false;

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
      worldStore.saveToStorage();
      return true;
    },

    syncEnemyAutoDefend() {
      const worldStore = useWorldMapStore();
      if (
        !this.combatActive ||
        this.combatTurnSide !== 'hero' ||
        !worldStore.map ||
        !worldStore.heroCoordinates
      )
        return;

      const adjacentEnemies = getOddQNeighbors(worldStore.heroCoordinates)
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

      const anchorEnemy = adjacentEnemies[0];
      const candidates = getOddQNeighbors(anchorEnemy.coordinates)
        .map((coord) => worldStore.getTileAt(coord))
        .filter((tile): tile is HexTileModel => !!tile);

      if (!candidates.length) return;

      const chosen = candidates[Math.floor(Math.random() * candidates.length)];

      this.combatMarkers.push({
        owner: 'enemy',
        coord: { ...chosen.coordinates },
        kind: 'defend',
        visible: false,
        toolKey: HEXOBJECT_KEYS.SHIELD,
      });

      useGameEventsStore().push('Combat', 'enemy auto-raised shield', 'INFO');
      worldStore.saveToStorage();
    },

    // ======================================================
    // ENEMY TURN RESOLUTION
    // ======================================================

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
        worldStore.saveToStorage();
      });

      return currentTile;
    },

    async ensureEnemyTurnResolution() {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();
      const events = useGameEventsStore();

      if (
        !this.combatActive ||
        this.combatTurnSide !== 'enemy' ||
        !worldStore.map ||
        !worldStore.heroCoordinates
      )
        return;
      if (this.isEnemyTurnResolving || worldStore.isHeroMoving) return;

      const map = worldStore.map;
      const enemyTile = this.getEnemyCombatActorTile();
      if (!enemyTile?.hexobject) {
        this.advanceCombatTurn();
        return;
      }

      this.isEnemyTurnResolving = true;

      try {
        const attackCandidates = getOddQNeighbors(worldStore.heroCoordinates)
          .map((coord) => {
            const tile = worldStore.getTileAt(coord);
            if (!tile) return null;

            const isCurrentEnemyTile =
              coord.columnIndex === enemyTile.coordinates.columnIndex &&
              coord.rowIndex === enemyTile.coordinates.rowIndex;
            if (isCurrentEnemyTile) {
              return {
                coord: { ...coord },
                route: [] as IHexCoordinates[],
              };
            }

            if (!tile.isRevealed) return null;
            if (tile.hexobject?.collision === EHexCollision.SOLID) return null;

            const path = findShortestPath(map, enemyTile.coordinates, coord, this.combatStepsLeft);
            if (!path || path.length < 2) return null;

            return {
              coord: { ...coord },
              route: path.slice(1),
            };
          })
          .filter(
            (candidate): candidate is { coord: IHexCoordinates; route: IHexCoordinates[] } =>
              !!candidate,
          );

        if (!attackCandidates.length) {
          this.combatStepsLeft = 0;
          worldStore.saveToStorage();
          return;
        }

        const chosenAttack = attackCandidates[Math.floor(Math.random() * attackCandidates.length)];
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
        worldStore.saveToStorage();
        this.revealCombatMarkers('hero');

        const rawDamage = this.getEnemyAttackDamage(currentEnemyTile.coordinates);
        const blockDefense = blockingMarker
          ? this.getCombatMarkerDefense(blockingMarker.toolKey)
          : 0;
        const finalDamage = Math.max(0, Number((rawDamage - blockDefense).toFixed(1)));

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

        const retreatCandidates = map.tiles
          .filter((tile) => tile.isRevealed)
          .filter((tile) => !tile.hexobject || tile === currentEnemyTile)
          .filter((tile) => hexDistance(tile.coordinates, worldStore.heroCoordinates!) > 1)
          .map((tile) => {
            const isCurrentEnemyTile =
              tile.coordinates.columnIndex === currentEnemyTile.coordinates.columnIndex &&
              tile.coordinates.rowIndex === currentEnemyTile.coordinates.rowIndex;
            if (isCurrentEnemyTile) return null;

            const path = findShortestPath(
              map,
              currentEnemyTile.coordinates,
              tile.coordinates,
              this.combatStepsLeft,
            );
            if (!path || path.length < 2) return null;

            return {
              coord: { ...tile.coordinates },
              route: path.slice(1),
            };
          })
          .filter(
            (candidate): candidate is { coord: IHexCoordinates; route: IHexCoordinates[] } =>
              !!candidate,
          );

        if (retreatCandidates.length && this.combatStepsLeft > 0) {
          const chosenRetreat =
            retreatCandidates[Math.floor(Math.random() * retreatCandidates.length)];
          currentEnemyTile = await this.moveEnemyAlongRoute(currentEnemyTile, chosenRetreat.route);
          events.push(
            'Combat',
            `${getCreatureOf(currentEnemyTile.hexobject)?.name ?? 'Enemy'} retreated`,
            'INFO',
          );
        }

        this.combatStepsLeft = 0;
        worldStore.saveToStorage();
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
      if (this.isEnemyTurnResolving || worldStore.isHeroMoving)
        return { ok: false, message: 'Wait until enemy turn finishes.' };
      if (this.combatAttackUsed) return { ok: false, message: 'Attack already used this turn.' };
      const capabilities = getToolCapabilities(toolKey as THeroToolKey);
      if (!capabilities.canAttack) return { ok: false, message: 'Need a weapon to attack.' };
      if (!worldStore.heroCoordinates) return { ok: false, message: 'Hero position is missing.' };

      const isAdjacent = getOddQNeighbors(worldStore.heroCoordinates).some(
        (n) =>
          n.columnIndex === target.coordinates.columnIndex &&
          n.rowIndex === target.coordinates.rowIndex,
      );
      if (!isAdjacent) return { ok: false, message: 'Target is not adjacent.' };

      const obj = target.hexobject;
      if (!obj || obj.groupType !== EHexobjectGroup.CREATURE || obj.creature?.faction !== 'enemy') {
        return { ok: false, message: 'Target is not an enemy creature.' };
      }
      const targetKey = obj.hexobjectKey;

      const blockingMarker = this.combatMarkers.find(
        (marker) =>
          marker.owner === 'enemy' &&
          marker.kind === 'defend' &&
          marker.coord.columnIndex === worldStore.heroCoordinates!.columnIndex &&
          marker.coord.rowIndex === worldStore.heroCoordinates!.rowIndex,
      );

      this.combatAttackUsed = true;
      this.combatActionMode = null;
      this.revealCombatMarkers('enemy');

      const attacker = getPrototype(toolKey as THexobjectKey);
      const attackMultiplier =
        attacker?.groupType === EHexobjectGroup.EQUIPMENT
          ? (attacker.weapon?.attackMultiplier ?? 1)
          : attacker?.groupType === EHexobjectGroup.TOOL
            ? (attacker.tool.attackMultiplier ?? 1)
            : 1;
      const rawDamage = Math.max(
        0.1,
        Number(((heroStore.hero?.attack ?? 8) * attackMultiplier).toFixed(1)),
      );
      const blockDefense = blockingMarker ? this.getCombatMarkerDefense(blockingMarker.toolKey) : 0;
      const damage = Math.max(0, Number((rawDamage - blockDefense).toFixed(1)));

      if (blockingMarker && damage <= 0) {
        useGameEventsStore().push(
          'Combat',
          `${obj.creature.name} blocked the hit [dmg:0]`,
          'BATTLE',
        );
        return { ok: true, message: 'Attack was blocked.' };
      }

      obj.creature.hp = normalizeHealthValue(obj.creature.hp - damage);
      if (blockingMarker) {
        useGameEventsStore().push(
          heroStore.hero?.name ?? 'Hero',
          `broke through block for [dmg:${damage.toFixed(1)}]`,
          'BATTLE',
        );
      } else {
        useGameEventsStore().push(
          heroStore.hero?.name ?? 'Hero',
          `hit ${obj.creature.name} for [dmg:${damage.toFixed(1)}]`,
          'BATTLE',
        );
      }

      if (obj.creature.hp <= 0) {
        target.hexobject =
          worldStore.currentLocationKey === 'cave' && targetKey === HEXOBJECT_KEYS.SKELETOR
            ? HexObjectFactory.create(HEXOBJECT_KEYS.GRAVE, target.coordinates)
            : null;
        heroStore.hero?.addKilled();
        useGameEventsStore().push('Combat', `${obj.creature.name} was defeated`, 'INFO');
      }

      if (!this.hasLivingEnemyCreatures()) {
        this.endCombat();
        useGameEventsStore().push('Combat', 'area cleared', 'INFO');
      }

      worldStore.saveToStorage();
      return { ok: true, message: 'Attack landed.' };
    },
  },
});
