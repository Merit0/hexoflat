import { defineStore } from "pinia";
import HexMapModel from "@/a-game-scenes/map-scene/models/hex-map-model";
import type { IHexCoordinates } from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import { HexTileModel } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import { coordinateKey, getOddQNeighbors, hexDistance } from "@/utils/hex-utils";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import { EHexCollision, EHexobjectGroup } from "@/abstraction/hexobject-abstraction";
import { WorldTickFeature } from "@/features/resource-features/world-tick-feature";
import { AddResourceSpawnerFeature } from "@/features/resource-features/add-resource-spawner-feature";
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import { CoinsGenerator } from "@/generators/coins-generator";
import { useHeroStore } from "@/stores/hero-store";
import { useGameEventsStore } from "@/stores/game-events-store";
import {LocationKey, MapDefinition, MapRegistry} from "@/registry/world-map-registry";
import {IHexMapPlacement} from "@/abstraction/hex-map-placement";
import { getScoutMoveStepsForSteps } from "@/services/hero-movement/scout-progression";
import { getReachableTileDistances } from "@/services/hero-movement/reachable-range-service";
import { findShortestPath } from "@/services/hero-movement/pathfinding-service";
import { executeMovementRoute } from "@/services/hero-movement/movement-executor";
import router, { ROUTES } from "@/router";
import { HexObjectFactory } from "@/factory/hex-object-factory";
import { THeroToolKey } from "@/registry/hexobjects/prototypes/equipment.prototypes";
import { getToolCapabilities } from "@/game-resolvers/interactions-resolver";
import { HEX_OBJECT_PROTOTYPES } from "@/registry/hexobjects/prototypes";
import { normalizeHealthValue, roundToSingleDecimal } from "@/utils/combat/health-format";

type TWorldState = {
    heroCoordinates: IHexCoordinates | null;
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

type CombatTurnSide = "hero" | "enemy";
type CombatActionMode = "attack" | "defend" | null;
type CombatMarker = {
    owner: CombatTurnSide;
    coord: IHexCoordinates;
    kind: "defend" | "attack-trace";
    visible: boolean;
    toolKey?: THeroToolKey | null;
};

const STORAGE_MAP_PREFIX = "hexoflat:world:map:v1:";
const STORAGE_STATE_PREFIX = "hexoflat:world:state:v1:";
const STORAGE_INDEX = "hexoflat:world:index:v1";
const STORAGE_RESPAWN_AT = "hexoflat:world:respawn-at:v1";

function newId(): string {
    return crypto.randomUUID();
}

function readIndex(): Partial<Record<LocationKey, string>> {
    const raw = localStorage.getItem(STORAGE_INDEX);
    return raw ? JSON.parse(raw) : {};
}

function writeIndex(index: Partial<Record<LocationKey, string>>) {
    localStorage.setItem(STORAGE_INDEX, JSON.stringify(index));
}

function readRespawnSchedule(): Partial<Record<LocationKey, number>> {
    const raw = localStorage.getItem(STORAGE_RESPAWN_AT);
    return raw ? JSON.parse(raw) : {};
}

function writeRespawnSchedule(schedule: Partial<Record<LocationKey, number>>) {
    localStorage.setItem(STORAGE_RESPAWN_AT, JSON.stringify(schedule));
}

let worldTimer: number | null = null;

export const useWorldMapStore = defineStore("world-map-store", {
    state: () => ({
        map: null as HexMapModel | null,
        heroCoordinates: null as IHexCoordinates | null,
        woodCollected: 0,
        isHeroMoving: false,
        isEnemyTurnResolving: false,
        pendingCampingRespawn: false,
        combatActive: false,
        combatTurnSide: "hero" as CombatTurnSide,
        combatStepsLeft: 0,
        combatStoredStepsBeforeDefend: null as number | null,
        combatTurnEndsAt: null as number | null,
        combatActionMode: null as CombatActionMode,
        combatAttackUsed: false,
        combatDefendUsed: false,
        combatMarkers: [] as CombatMarker[],

        currentLocationKey: "camping" as LocationKey,
        currentMapId: null as string | null,
    }),

    actions: {
        getTileAt(coords: IHexCoordinates): HexTileModel | null {
            if (!this.map) return null;

            return this.map.tiles.find(
                (t: HexTileModel) =>
                    t.coordinates.columnIndex === coords.columnIndex &&
                    t.coordinates.rowIndex === coords.rowIndex
            ) ?? null;
        },

        getEnemyTilesSeeingHero(): HexTileModel[] {
            if (!this.map || !this.heroCoordinates) return [];

            return this.map.tiles
                .filter((tile): tile is HexTileModel => !!tile?.hexobject)
                .filter((tile) => tile.hexobject?.groupType === EHexobjectGroup.CREATURE)
                .filter((tile) => tile.hexobject?.creature?.faction === "enemy")
                .filter((tile) => {
                    const visionRange = tile.hexobject!.creature!.visionRange ?? 3;
                    return hexDistance(tile.coordinates, this.heroCoordinates!) <= visionRange;
                });
        },

        revealCombatVision() {
            if (!this.map) return;

            const enemies = this.getEnemyTilesSeeingHero();
            if (!enemies.length) return;

            for (const enemyTile of enemies) {
                const visionRange = enemyTile.hexobject?.groupType === EHexobjectGroup.CREATURE
                    ? (enemyTile.hexobject.creature.visionRange ?? 3)
                    : 3;

                for (const tile of this.map.tiles) {
                    if (hexDistance(enemyTile.coordinates, tile.coordinates) <= visionRange) {
                        tile.isRevealed = true;
                    }
                }
            }
        },

        getCombatMoveBudget(): number {
            return 10;
        },

        getEnemyAttackDamage(enemyCoords?: IHexCoordinates | null) {
            if (!enemyCoords) return 1;
            const enemyTile = this.getTileAt(enemyCoords);
            if (enemyTile?.hexobject?.groupType !== EHexobjectGroup.CREATURE) return 1;
            return enemyTile.hexobject.creature.attack ?? 1;
        },

        getCombatMarkerDefense(toolKey?: THeroToolKey | null) {
            if (!toolKey) return 0;

            const proto = HEX_OBJECT_PROTOTYPES[toolKey];
            if (!proto) return 0;

            if (proto.groupType === EHexobjectGroup.EQUIPMENT) {
                return Math.max(0, Number(proto.equipment.defense ?? 0));
            }

            if (proto.groupType === EHexobjectGroup.TOOL) {
                return Math.max(0, Number(proto.tool.defense ?? 0));
            }

            return 0;
        },

        clearStoredLocation(locationKey: LocationKey, mapId: string) {
            const heroStore = useHeroStore();
            const index = readIndex();

            localStorage.removeItem(STORAGE_MAP_PREFIX + mapId);
            localStorage.removeItem(STORAGE_STATE_PREFIX + mapId);

            if (index[locationKey] === mapId) {
                delete index[locationKey];
                writeIndex(index);
            }

            heroStore.forgetPosition(mapId);
        },

        forgetStoredLocationPosition(locationKey: LocationKey) {
            const heroStore = useHeroStore();
            const index = readIndex();
            const mapId = index[locationKey];

            if (!mapId) return;

            heroStore.forgetPosition(mapId);
        },

        scheduleLocationRespawn(locationKey: LocationKey, delayMs: number) {
            const schedule = readRespawnSchedule();
            schedule[locationKey] = Date.now() + delayMs;
            writeRespawnSchedule(schedule);
        },

        clearLocationRespawn(locationKey: LocationKey) {
            const schedule = readRespawnSchedule();
            if (!(locationKey in schedule)) return;
            delete schedule[locationKey];
            writeRespawnSchedule(schedule);
        },

        getLocationRespawnRemainingMs(locationKey: LocationKey) {
            const schedule = readRespawnSchedule();
            const respawnAt = schedule[locationKey];
            if (!respawnAt) return 0;

            return Math.max(0, respawnAt - Date.now());
        },

        isLocationRespawning(locationKey: LocationKey) {
            return this.getLocationRespawnRemainingMs(locationKey) > 0;
        },

        syncLocationRespawn(locationKey: LocationKey) {
            const schedule = readRespawnSchedule();
            const respawnAt = schedule[locationKey];
            if (!respawnAt) return;
            if (Date.now() < respawnAt) return;

            const index = readIndex();
            const mapId = index[locationKey];
            if (mapId) {
                this.clearStoredLocation(locationKey, mapId);
            }

            delete schedule[locationKey];
            writeRespawnSchedule(schedule);
        },

        hasLivingEnemyCreatures() {
            if (!this.map) return false;

            return this.map.tiles.some((tile) =>
                tile.hexobject?.groupType === EHexobjectGroup.CREATURE &&
                tile.hexobject.creature?.faction === "enemy"
            );
        },

        hasGraveMarker() {
            if (!this.map) return false;
            return this.map.tiles.some((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.GRAVE);
        },

        placeHeroAtCampfire() {
            if (!this.map) return;

            const campfireTile = this.map.tiles.find(
                (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.FIREPLACE
            );

            if (!campfireTile) {
                this.placeHeroAtEntry("camping");
                return;
            }

            const byKey = new Map<string, HexTileModel>();
            for (const tile of this.map.tiles) {
                byKey.set(coordinateKey(tile.coordinates), tile);
            }

            const neighbor = getOddQNeighbors(campfireTile.coordinates)
                .map((coord) => byKey.get(coordinateKey(coord)))
                .find((tile) => tile && tile.hexobject?.collision !== EHexCollision.SOLID);

            this.heroCoordinates = neighbor
                ? { ...neighbor.coordinates }
                : { ...campfireTile.coordinates };
        },

        async respawnHeroAtCamping() {
            const heroStore = useHeroStore();
            const events = useGameEventsStore();
            const defeatedLocationKey = this.currentLocationKey;
            const defeatedMapId = this.currentMapId;

            this.endCombat();
            if (defeatedMapId) {
                this.clearStoredLocation(defeatedLocationKey, defeatedMapId);
            }
            this.forgetStoredLocationPosition("silesia");

            this.stopWorldLoop();
            this.pendingCampingRespawn = true;
            this.heroCoordinates = null;
            this.currentMapId = null;
            heroStore.setPendingLocation("camping");
            heroStore.reviveAtOneHp();
            events.push("Combat", "hero was defeated and returned to camping", "INFO");

            if (
                router.currentRoute.value.name === ROUTES.WORLD
                && router.currentRoute.value.params.locationKey !== "camping"
            ) {
                await router.push({
                    name: ROUTES.WORLD,
                    params: { locationKey: "camping" },
                });
                return;
            }

            this.goToLocation("camping");
        },

        startCombat() {
            if (this.combatActive) return;

            this.combatActive = true;
            this.revealCombatVision();
            this.beginCombatTurn("hero");
            this.saveToStorage();
            useGameEventsStore().push("Combat", "combat mode engaged", "INFO");
        },

        endCombat() {
            this.combatActive = false;
            this.isEnemyTurnResolving = false;
            this.combatTurnSide = "hero";
            this.combatStepsLeft = 0;
            this.combatStoredStepsBeforeDefend = null;
            this.combatTurnEndsAt = null;
            this.combatActionMode = null;
            this.combatAttackUsed = false;
            this.combatDefendUsed = false;
            this.combatMarkers = [];
            this.saveToStorage();
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

            useGameEventsStore().push("Combat", `${side} turn started`, "INFO");

            if (side === "hero") {
                this.syncEnemyAutoDefend();
            }

            this.saveToStorage();

            if (side === "enemy") {
                void this.ensureEnemyTurnResolution();
            }
        },

        advanceCombatTurn() {
            if (!this.combatActive) return;
            if (this.isEnemyTurnResolving) return;

            const nextSide: CombatTurnSide = this.combatTurnSide === "hero" ? "enemy" : "hero";
            this.beginCombatTurn(nextSide);
        },

        beginCombatAction(mode: Exclude<CombatActionMode, null>) {
            if (!this.combatActive) return;
            if (this.combatTurnSide !== "hero") return;
            if (this.isEnemyTurnResolving || this.isHeroMoving) return;
            if (mode === "attack" && this.combatAttackUsed) return;
            if (mode === "defend" && this.combatDefendUsed) return;
            this.combatActionMode = this.combatActionMode === mode ? null : mode;
            this.saveToStorage();
        },

        revealCombatMarkers(owner: CombatTurnSide, kind: CombatMarker["kind"] = "defend") {
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
                this.saveToStorage();
            }
        },

        clearCombatAttackTrace() {
            const nextMarkers = this.combatMarkers.filter((marker) => marker.kind !== "attack-trace");
            if (nextMarkers.length === this.combatMarkers.length) return;

            this.combatMarkers = nextMarkers;
            this.saveToStorage();
        },

        cancelCombatAction() {
            this.combatActionMode = null;
            this.saveToStorage();
        },

        canPlaceCombatDefendMarker(target: IHexCoordinates): boolean {
            if (!this.combatActive) return false;
            if (this.combatTurnSide !== "hero") return false;
            if (this.isEnemyTurnResolving || this.isHeroMoving) return false;
            if (!this.heroCoordinates) return false;
            if (this.combatDefendUsed) return false;

            const isAdjacent = getOddQNeighbors(this.heroCoordinates).some((n) =>
                n.columnIndex === target.columnIndex && n.rowIndex === target.rowIndex
            );
            if (!isAdjacent) return false;

            const tile = this.getTileAt(target);
            if (!tile || !tile.isRevealed) return false;
            if (tile.hexobject?.collision === EHexCollision.SOLID) return false;
            if (tile.hexobject) return false;

            return true;
        },

        placeCombatDefendMarker(target: IHexCoordinates, toolKey?: THeroToolKey | null): boolean {
            if (!this.canPlaceCombatDefendMarker(target)) return false;

            const capabilities = toolKey ? getToolCapabilities(toolKey) : {};
            if (!capabilities.canBlock) return false;

            this.combatMarkers = this.combatMarkers.filter((marker) => {
                if (marker.owner !== "hero") return true;

                return marker.coord.columnIndex !== target.columnIndex || marker.coord.rowIndex !== target.rowIndex;
            });

            this.combatMarkers.push({
                owner: "hero",
                coord: { ...target },
                kind: "defend",
                visible: true,
                toolKey: toolKey ?? null,
            });

            this.combatDefendUsed = true;
            this.combatStoredStepsBeforeDefend = this.combatStepsLeft;
            this.combatStepsLeft = 0;
            this.combatActionMode = null;
            useGameEventsStore().push("Combat", "hero placed shield", "INFO");
            this.saveToStorage();
            return true;
        },

        removeCombatDefendMarker(target: IHexCoordinates): boolean {
            if (!this.combatActive) return false;
            if (this.combatTurnSide !== "hero") return false;
            if (this.isEnemyTurnResolving || this.isHeroMoving) return false;

            const marker = this.combatMarkers.find((item) =>
                item.owner === "hero"
                && item.kind === "defend"
                && item.coord.columnIndex === target.columnIndex
                && item.coord.rowIndex === target.rowIndex
            );
            if (!marker) return false;

            this.combatMarkers = this.combatMarkers.filter((item) => item !== marker);
            this.combatDefendUsed = false;
            this.combatStepsLeft = this.combatStoredStepsBeforeDefend ?? this.combatStepsLeft;
            this.combatStoredStepsBeforeDefend = null;
            this.combatActionMode = null;
            useGameEventsStore().push("Combat", "hero removed shield", "INFO");
            this.saveToStorage();
            return true;
        },

        syncEnemyAutoDefend() {
            if (!this.combatActive || this.combatTurnSide !== "hero" || !this.map || !this.heroCoordinates) return;

            const adjacentEnemies = getOddQNeighbors(this.heroCoordinates)
                .map((coord) => this.getTileAt(coord))
                .filter((tile): tile is HexTileModel => !!tile)
                .filter((tile) => {
                    const obj = tile.hexobject;
                    return obj?.groupType === EHexobjectGroup.CREATURE && obj.creature.faction === "enemy";
                });

            if (!adjacentEnemies.length) return;

            const alreadyHasEnemyShield = this.combatMarkers.some((marker) => marker.owner === "enemy" && marker.kind === "defend");
            if (alreadyHasEnemyShield) return;

            const anchorEnemy = adjacentEnemies[0];
            const candidates = getOddQNeighbors(anchorEnemy.coordinates)
                .map((coord) => this.getTileAt(coord))
                .filter((tile): tile is HexTileModel => !!tile);

            if (!candidates.length) return;

            const chosen = candidates[Math.floor(Math.random() * candidates.length)];

            this.combatMarkers.push({
                owner: "enemy",
                coord: { ...chosen.coordinates },
                kind: "defend",
                visible: false,
                toolKey: HEXOBJECT_KEYS.SHIELD,
            });

            useGameEventsStore().push("Combat", "enemy auto-raised shield", "INFO");
            this.saveToStorage();
        },

        getEnemyCombatActorTile(): HexTileModel | null {
            if (!this.map || !this.heroCoordinates) return null;

            const enemyTiles = this.map.tiles
                .filter((tile): tile is HexTileModel => !!tile.hexobject)
                .filter((tile) => {
                    const obj = tile.hexobject;
                    return obj?.groupType === EHexobjectGroup.CREATURE && obj.creature.faction === "enemy";
                })
                .sort((a, b) => hexDistance(a.coordinates, this.heroCoordinates!) - hexDistance(b.coordinates, this.heroCoordinates!));

            return enemyTiles[0] ?? null;
        },

        async moveEnemyAlongRoute(enemyTile: HexTileModel, route: IHexCoordinates[]) {
            if (!route.length || !enemyTile.hexobject) return enemyTile;

            let currentTile = enemyTile;
            const enemyObject = enemyTile.hexobject;

            await executeMovementRoute(route, async (coord) => {
                const nextTile = this.getTileAt(coord);
                if (!nextTile || nextTile === currentTile) return;

                currentTile.hexobject = null;
                nextTile.hexobject = enemyObject;
                currentTile = nextTile;
                this.combatStepsLeft = Math.max(0, this.combatStepsLeft - 1);
                this.clearCombatAttackTrace();
                this.revealAroundHero();
                this.saveToStorage();
            });

            return currentTile;
        },

        async ensureEnemyTurnResolution() {
            const heroStore = useHeroStore();
            const events = useGameEventsStore();

            if (!this.combatActive || this.combatTurnSide !== "enemy" || !this.map || !this.heroCoordinates) return;
            if (this.isEnemyTurnResolving || this.isHeroMoving) return;

            const enemyTile = this.getEnemyCombatActorTile();
            if (!enemyTile?.hexobject) {
                this.advanceCombatTurn();
                return;
            }

            this.isEnemyTurnResolving = true;

            try {
                const attackCandidates = getOddQNeighbors(this.heroCoordinates)
                    .map((coord) => {
                        const tile = this.getTileAt(coord);
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

                        const path = findShortestPath(this.map, enemyTile.coordinates, coord, this.combatStepsLeft);
                        if (!path || path.length < 2) return null;

                        return {
                            coord: { ...coord },
                            route: path.slice(1),
                        };
                    })
                    .filter((candidate): candidate is { coord: IHexCoordinates; route: IHexCoordinates[] } => !!candidate);

                if (!attackCandidates.length) {
                    this.combatStepsLeft = 0;
                    this.saveToStorage();
                    return;
                }

                const chosenAttack = attackCandidates[Math.floor(Math.random() * attackCandidates.length)];
                let currentEnemyTile = await this.moveEnemyAlongRoute(enemyTile, chosenAttack.route);

                await new Promise((resolve) => window.setTimeout(resolve, 5_000));

                const blockingMarker = this.combatMarkers.find((marker) =>
                    marker.owner === "hero"
                    && marker.kind === "defend"
                    && marker.coord.columnIndex === chosenAttack.coord.columnIndex
                    && marker.coord.rowIndex === chosenAttack.coord.rowIndex
                );

                this.combatMarkers = this.combatMarkers.filter((marker) => !(marker.owner === "enemy" && marker.kind === "attack-trace"));
                this.combatMarkers.push({
                    owner: "enemy",
                    coord: { ...currentEnemyTile.coordinates },
                    kind: "attack-trace",
                    visible: true,
                    toolKey: null,
                });
                this.saveToStorage();
                this.revealCombatMarkers("hero");

                const rawDamage = this.getEnemyAttackDamage(currentEnemyTile.coordinates);
                const blockDefense = blockingMarker ? this.getCombatMarkerDefense(blockingMarker.toolKey) : 0;
                const finalDamage = Math.max(0, Number((rawDamage - blockDefense).toFixed(1)));

                if (blockingMarker && finalDamage <= 0) {
                    events.push(
                        "Combat",
                        `${currentEnemyTile.hexobject?.creature?.name ?? "Enemy"} blocked by shield [dmg:0]`,
                        "BATTLE"
                    );
                } else {
                    heroStore.takeDamage(finalDamage);
                    if (blockingMarker) {
                        events.push(
                            currentEnemyTile.hexobject?.creature?.name ?? "Enemy",
                            `broke through block for [dmg:${finalDamage.toFixed(1)}]`,
                            "BATTLE"
                        );
                    } else {
                        events.push(
                            currentEnemyTile.hexobject?.creature?.name ?? "Enemy",
                            `hit ${heroStore.hero?.name ?? "Hero"} for [dmg:${finalDamage.toFixed(1)}]`,
                            "BATTLE"
                        );
                    }

                    if ((heroStore.hero.currentHealth ?? 0) <= 0) {
                        await this.respawnHeroAtCamping();
                        return;
                    }
                }

                const retreatCandidates = this.map.tiles
                    .filter((tile) => tile.isRevealed)
                    .filter((tile) => !tile.hexobject || tile === currentEnemyTile)
                    .filter((tile) => hexDistance(tile.coordinates, this.heroCoordinates!) > 1)
                    .map((tile) => {
                        const isCurrentEnemyTile =
                            tile.coordinates.columnIndex === currentEnemyTile.coordinates.columnIndex &&
                            tile.coordinates.rowIndex === currentEnemyTile.coordinates.rowIndex;
                        if (isCurrentEnemyTile) return null;

                        const path = findShortestPath(this.map!, currentEnemyTile.coordinates, tile.coordinates, this.combatStepsLeft);
                        if (!path || path.length < 2) return null;

                        return {
                            coord: { ...tile.coordinates },
                            route: path.slice(1),
                        };
                    })
                    .filter((candidate): candidate is { coord: IHexCoordinates; route: IHexCoordinates[] } => !!candidate);

                if (retreatCandidates.length && this.combatStepsLeft > 0) {
                    const chosenRetreat = retreatCandidates[Math.floor(Math.random() * retreatCandidates.length)];
                    currentEnemyTile = await this.moveEnemyAlongRoute(currentEnemyTile, chosenRetreat.route);
                    events.push("Combat", `${currentEnemyTile.hexobject?.creature?.name ?? "Enemy"} retreated`, "INFO");
                }

                this.combatStepsLeft = 0;
                this.saveToStorage();
            } finally {
                this.isEnemyTurnResolving = false;

                if (this.combatActive && this.combatTurnSide === "enemy") {
                    this.advanceCombatTurn();
                }
            }
        },

        performHeroCombatAttack(target: HexTileModel, toolKey: string): { ok: boolean; message: string } {
            const heroStore = useHeroStore();

            if (!this.combatActive) return { ok: false, message: "Combat is not active." };
            if (this.combatTurnSide !== "hero") return { ok: false, message: "Not hero turn." };
            if (this.isEnemyTurnResolving || this.isHeroMoving) return { ok: false, message: "Wait until enemy turn finishes." };
            if (this.combatAttackUsed) return { ok: false, message: "Attack already used this turn." };
            const capabilities = getToolCapabilities(toolKey as THeroToolKey);
            if (!capabilities.canAttack) return { ok: false, message: "Need a weapon to attack." };
            if (!this.heroCoordinates) return { ok: false, message: "Hero position is missing." };

            const isAdjacent = getOddQNeighbors(this.heroCoordinates).some((n) =>
                n.columnIndex === target.coordinates.columnIndex &&
                n.rowIndex === target.coordinates.rowIndex
            );
            if (!isAdjacent) return { ok: false, message: "Target is not adjacent." };

            const obj = target.hexobject;
            if (!obj || obj.groupType !== EHexobjectGroup.CREATURE || obj.creature?.faction !== "enemy") {
                return { ok: false, message: "Target is not an enemy creature." };
            }
            const targetKey = obj.hexobjectKey;

            const blockingMarker = this.combatMarkers.find((marker) =>
                marker.owner === "enemy"
                && marker.kind === "defend"
                && marker.coord.columnIndex === this.heroCoordinates!.columnIndex
                && marker.coord.rowIndex === this.heroCoordinates!.rowIndex
            );

            this.combatAttackUsed = true;
            this.combatActionMode = null;
            this.revealCombatMarkers("enemy");

            const attacker = HEX_OBJECT_PROTOTYPES[toolKey as keyof typeof HEX_OBJECT_PROTOTYPES];
            const attackMultiplier =
                attacker?.groupType === EHexobjectGroup.EQUIPMENT
                    ? (attacker.weapon?.attackMultiplier ?? 1)
                    : attacker?.groupType === EHexobjectGroup.TOOL
                        ? (attacker.tool.attackMultiplier ?? 1)
                    : 1;
            const rawDamage = Math.max(0.1, Number(((heroStore.hero?.attack ?? 8) * attackMultiplier).toFixed(1)));
            const blockDefense = blockingMarker ? this.getCombatMarkerDefense(blockingMarker.toolKey) : 0;
            const damage = Math.max(0, Number((rawDamage - blockDefense).toFixed(1)));

            if (blockingMarker && damage <= 0) {
                useGameEventsStore().push(
                    "Combat",
                    `${obj.creature.name} blocked the hit [dmg:0]`,
                    "BATTLE"
                );
                return { ok: true, message: "Attack was blocked." };
            }

            obj.creature.hp = normalizeHealthValue(obj.creature.hp - damage);
            if (blockingMarker) {
                useGameEventsStore().push(
                    heroStore.hero?.name ?? "Hero",
                    `broke through block for [dmg:${damage.toFixed(1)}]`,
                    "BATTLE"
                );
            } else {
                useGameEventsStore().push(
                    heroStore.hero?.name ?? "Hero",
                    `hit ${obj.creature.name} for [dmg:${damage.toFixed(1)}]`,
                    "BATTLE"
                );
            }

            if (obj.creature.hp <= 0) {
                target.hexobject = this.currentLocationKey === "cave" && targetKey === HEXOBJECT_KEYS.SKELETOR
                    ? HexObjectFactory.create(HEXOBJECT_KEYS.GRAVE, target.coordinates)
                    : null;
                heroStore.hero?.addKilled();
                useGameEventsStore().push("Combat", `${obj.creature.name} was defeated`, "INFO");
            }

            if (!this.hasLivingEnemyCreatures()) {
                this.endCombat();
                useGameEventsStore().push("Combat", "area cleared", "INFO");
            }

            this.saveToStorage();
            return { ok: true, message: "Attack landed." };
        },

        bootstrapWorld() {
            const heroStore = useHeroStore();

            const locationKey = heroStore.nav.locationKey;
            const mapId = heroStore.nav.locationMapId ?? undefined;

            this.goToLocation(locationKey, mapId);

            if (this.currentMapId) {
                const remembered = heroStore.nav.positionByMapId[this.currentMapId];
                if (remembered) {
                    this.heroCoordinates = { ...remembered };
                    this.revealAroundHero();
                    this.saveToStorage(this.currentMapId);
                }
            }
        },

        // ======================================================
        // NAVIGATION
        // ======================================================

        goToLocation(locationKey: LocationKey) {
            const heroStore = useHeroStore();

            if (locationKey !== this.currentLocationKey && this.isLocationRespawning(locationKey)) {
                useGameEventsStore().push("World", `${MapRegistry.get(locationKey).title} is sealed for now.`, "INFO");
                return;
            }

            if (this.currentLocationKey === "cave" && locationKey !== "cave" && this.hasGraveMarker()) {
                this.scheduleLocationRespawn("cave", 60_000);
            }

            if (this.currentMapId && this.heroCoordinates) {
                heroStore.rememberPosition(this.currentMapId, this.heroCoordinates);
            }
            if (this.currentMapId) this.saveToStorage(this.currentMapId);

            this.stopWorldLoop();
            this.openLocation(locationKey);

            if (!this.currentMapId) return;

            const remembered = heroStore.nav.positionByMapId[this.currentMapId];

            if (this.pendingCampingRespawn && locationKey === "camping") {
                this.placeHeroAtCampfire();
            } else if (remembered) {
                this.heroCoordinates = { ...remembered };
            } else {
                this.placeHeroAtEntry(locationKey);
            }

            this.pendingCampingRespawn = false;
            this.revealAroundHero();
            this.revealEntryTile();
            this.saveToStorage(this.currentMapId);
        },

        revealEntryTile() {
            if (!this.map) return;

            const entryPlacement: IHexMapPlacement =
                this.map.config?.find((p: IHexMapPlacement) => p.entry?.type === "DEFAULT") ??
                this.map.config?.find((p: IHexMapPlacement) => p.entry?.type === "SECRET");

            const entryPlaceCoordinates: IHexCoordinates | undefined = entryPlacement?.coordinates?.[0];
            if (!entryPlaceCoordinates) return;

            const entryTile = this.map.tiles.find((t: HexTileModel) =>
                t.coordinates.columnIndex === entryPlaceCoordinates.columnIndex &&
                t.coordinates.rowIndex === entryPlaceCoordinates.rowIndex
            );

            if (entryTile) {
                entryTile.isRevealed = true;
            }
        },

        openLocation(locationKey: LocationKey, preferredMapId?: string) {
            const heroStore = useHeroStore();

            this.syncLocationRespawn(locationKey);

            const index = readIndex();
            const mapId = preferredMapId ?? index[locationKey] ?? newId();

            if (!index[locationKey]) {
                index[locationKey] = mapId;
                writeIndex(index);
            }

            this.currentLocationKey = locationKey;
            this.currentMapId = mapId;

            this.loadFromStorage(mapId);

            if (!this.map) {
                const def = MapRegistry.get(locationKey);
                this.map = def.create();

                this.initFog();

                this.hydrateResourcesFromConfig();

                this.initCoins();
                this.saveToStorage(mapId);
            }

            this.startWorldLoop();
            heroStore.setLocation(locationKey, mapId);
        },

        // ======================================================
        // MAP LIFECYCLE
        // ======================================================

        loadFromStorage(mapId: string) {
            const savedMap = localStorage.getItem(STORAGE_MAP_PREFIX + mapId);

            if (savedMap) {
                this.map = HexMapModel.fromJSON(JSON.parse(savedMap));
                this.hydrateResourcesFromConfig();

                const changed = new WorldTickFeature(this.map).tick(Date.now());
                if (changed) this.saveToStorage(mapId);
            } else {
                this.map = null;
            }

            const savedState = localStorage.getItem(STORAGE_STATE_PREFIX + mapId);
            if (savedState) {
                const raw = JSON.parse(savedState) as Partial<TWorldState>;
                this.heroCoordinates = raw.heroCoordinates ?? null;
                this.combatActive = raw.combatActive ?? false;
                this.combatTurnSide = raw.combatTurnSide ?? "hero";
                this.combatStepsLeft = raw.combatStepsLeft ?? 0;
                this.combatStoredStepsBeforeDefend = raw.combatStoredStepsBeforeDefend ?? null;
                this.combatTurnEndsAt = raw.combatTurnEndsAt ?? null;
                this.combatActionMode = raw.combatActionMode ?? null;
                this.combatAttackUsed = raw.combatAttackUsed ?? false;
                this.combatDefendUsed = raw.combatDefendUsed ?? false;
                this.combatMarkers = raw.combatMarkers?.map((marker) => ({
                    owner: marker.owner,
                    coord: { ...marker.coord },
                    kind: marker.kind,
                    visible: marker.visible ?? true,
                    toolKey: marker.toolKey ?? null,
                })) ?? [];
            } else {
                this.heroCoordinates = null;
                this.woodCollected = 0;
                this.combatActive = false;
                this.combatTurnSide = "hero";
                this.combatStepsLeft = 0;
                this.combatStoredStepsBeforeDefend = null;
                this.combatTurnEndsAt = null;
                this.combatActionMode = null;
                this.combatAttackUsed = false;
                this.combatDefendUsed = false;
                this.combatMarkers = [];
            }

            if (!this.map) return;

            if (!this.heroCoordinates) {
                const def = MapRegistry.get(this.currentLocationKey);

                const entryTile = this.map.tiles.find(
                    (t: HexTileModel) => t.hexobject?.hexobjectKey === def.entryHexobjectKey
                );

                if (entryTile) {
                    const byKey = new Map<string, HexTileModel>();
                    for (const t of this.map.tiles) {
                        byKey.set(coordinateKey(t.coordinates), t);
                    }

                    const neighbor = getOddQNeighbors(entryTile.coordinates)
                        .map(c => byKey.get(coordinateKey(c)))
                        .find(t => t && t.hexobject?.collision !== EHexCollision.SOLID);

                    this.heroCoordinates = neighbor
                        ? { ...neighbor.coordinates }
                        : { ...entryTile.coordinates };
                } else {
                    this.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
                }

                this.revealAroundHero();
                this.saveToStorage(mapId);
                return;
            }

            this.revealAroundHero();
            if (this.combatActive) {
                this.revealCombatVision();
            }
        },

        saveToStorage(mapId = this.currentMapId) {
            if (!mapId) return;

            if (this.map) {
                localStorage.setItem(
                    STORAGE_MAP_PREFIX + mapId,
                    JSON.stringify(this.map)
                );
            }

            const state: TWorldState = {
                heroCoordinates: this.heroCoordinates,
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

            localStorage.setItem(
                STORAGE_STATE_PREFIX + mapId,
                JSON.stringify(state)
            );
        },

        // ======================================================
        // WORLD LOOP
        // ======================================================

        startWorldLoop() {
            if (worldTimer) return;

            worldTimer = window.setInterval(() => {
                if (!this.map || !this.currentMapId) return;
                const changed = new WorldTickFeature(this.map).tick(Date.now());
                if (changed) this.saveToStorage(this.currentMapId);
            }, 250);
        },

        stopWorldLoop() {
            if (worldTimer) {
                clearInterval(worldTimer);
                worldTimer = null;
            }
        },

        // ======================================================
        // HERO MOVEMENT & VISIBILITY
        // ======================================================

        placeHeroAtEntry(locationKey: LocationKey) {
            if (!this.map) return;

            const def: MapDefinition = MapRegistry.get(locationKey);
            const entryTile = this.map.tiles.find(
                (t: HexTileModel) => t.hexobject?.hexobjectKey === def.entryHexobjectKey
            );

            if (!entryTile) {
                this.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
                return;
            }

            const byKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) {
                byKey.set(coordinateKey(t.coordinates), t);
            }

            const neighbors = getOddQNeighbors(entryTile.coordinates)
                .map(c => byKey.get(coordinateKey(c)))
                .filter((t): t is HexTileModel => !!t)
                .filter(t => t.hexobject?.collision !== EHexCollision.SOLID);

            const chosen = neighbors.length
                ? neighbors[Math.floor(Math.random() * neighbors.length)]
                : entryTile;

            this.heroCoordinates = { ...chosen.coordinates };
        },

        initFog() {
            if (!this.map) return;

            const all = this.map.fogPolicy === "ALL_REVEALED";
            for (const t of this.map.tiles) t.isRevealed = all;
        },

        revealAroundHero() {
            if (!this.map || !this.heroCoordinates) return;

            const byKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) byKey.set(coordinateKey(t.coordinates), t);

            const coords = [
                this.heroCoordinates,
                ...getOddQNeighbors(this.heroCoordinates),
            ];

            for (const c of coords) {
                const tile = byKey.get(coordinateKey(c));
                if (tile) tile.isRevealed = true;
            }
        },

        async moveHeroTo(target: IHexCoordinates): Promise<boolean> {
            const heroToolStore = useHeroToolStore();
            const heroStore = useHeroStore();
            const events = useGameEventsStore();

            if (!this.map || !this.heroCoordinates) return false;
            if (heroToolStore.isDragging || this.isHeroMoving) return false;
            if (this.combatActive && this.combatTurnSide !== "hero") return false;
            if (this.combatActive && this.combatStepsLeft <= 0) return false;

            const tile = this.map.tiles.find(
                (t: HexTileModel) =>
                    t.coordinates.columnIndex === target.columnIndex &&
                    t.coordinates.rowIndex === target.rowIndex
            );
            if (!tile || !tile.isRevealed) return false;
            if (tile.hexobject?.collision === EHexCollision.SOLID) return false;
            if (tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CAMPING_ENTRANCE) return false;

            const moveSteps = this.combatActive
                ? this.combatStepsLeft
                : getScoutMoveStepsForSteps(heroStore.hero?.heroSteps ?? 0);
            const reachable = getReachableTileDistances(this.map, this.heroCoordinates, moveSteps);
            const targetKey = coordinateKey(target);
            if (!reachable.has(targetKey)) return false;

            const path = findShortestPath(this.map, this.heroCoordinates, target, moveSteps);
            if (!path || path.length < 2) return false;

            const route = path.slice(1);
            let stepsTaken = 0;

            if (heroToolStore.isLocked) {
                heroToolStore.cancelLockedAction("MOVE");
                this.saveToStorage();
            }

            this.isHeroMoving = true;

            try {
                await executeMovementRoute(route, async (coord) => {
                    this.heroCoordinates = { ...coord };
                    stepsTaken += 1;
                    if (this.combatActive) {
                        this.combatStepsLeft = Math.max(0, this.combatStepsLeft - 1);
                        this.clearCombatAttackTrace();
                    }
                    heroStore.hero?.makeStep();
                    heroStore.saveProgressToStorage();

                    this.revealAroundHero();
                    if (this.combatActive) {
                        this.syncEnemyAutoDefend();
                    }
                    this.saveToStorage();

                    if (this.currentMapId && this.heroCoordinates) {
                        heroStore.rememberPosition(this.currentMapId, this.heroCoordinates);
                    }

                    if (this.combatActive && this.combatStepsLeft <= 0) {
                        return false;
                    }
                });
            } finally {
                this.isHeroMoving = false;
            }

            events.push(
                heroStore.hero?.name ?? "Hero",
                `moved to [${this.heroCoordinates.columnIndex}, ${this.heroCoordinates.rowIndex}] by ${stepsTaken} step(s)`,
                "INFO"
            );

            return true;
        },

        revealTile(tileCoordinates: IHexCoordinates) {
            if (!this.map || !this.heroCoordinates) return;

            const tile = this.map.tiles.find(
                (t: HexTileModel) => t.coordinates.columnIndex === tileCoordinates.columnIndex
                    && t.coordinates.rowIndex === tileCoordinates.rowIndex
            );
            if (!tile) return;

            if (tile.isRevealed) return;

            const isHeroTile =
                tile.coordinates.columnIndex === this.heroCoordinates.columnIndex &&
                tile.coordinates.rowIndex === this.heroCoordinates.rowIndex;

            if (isHeroTile) return;

            const neighbors = getOddQNeighbors(this.heroCoordinates);
            const isNeighbor = neighbors.some(n =>
                n.columnIndex === tile.coordinates.columnIndex &&
                n.rowIndex === tile.coordinates.rowIndex
            );

            if (!isNeighbor) return;

            tile.isRevealed = true;
            this.saveToStorage();
        },

        // ======================================================
        // RESOURCES
        // ======================================================

        hydrateResourcesFromConfig() {
            if (!this.map?.config?.length) return;

            const tileByKey = new Map<string, HexTileModel>();
            for (const t of this.map.tiles) {
                tileByKey.set(`${t.coordinates.columnIndex}:${t.coordinates.rowIndex}`, t);
            }

            for (const placement of this.map.config) {
                for (const c of placement.coordinates) {
                    const tile = tileByKey.get(`${c.columnIndex}:${c.rowIndex}`);
                    if (tile && !tile.resourceSpawner) {
                        new AddResourceSpawnerFeature(tile, placement.hexobject!).add();
                    }
                }
            }
        },

        initCoins() {
            if (!this.map) return;

            new CoinsGenerator(this.map, {
                chance: 0.05,
                maxCoinsOnMap: 15,
                minAmount: 1,
                maxAmount: 5,
                skipSpawnerTiles: true,
            }).generate();
        },

        // ======================================================
        // RESET
        // ======================================================

        clearAllWorlds() {
            this.stopWorldLoop();

            const index = readIndex();
            for (const mapId of Object.values(index)) {
                localStorage.removeItem(STORAGE_MAP_PREFIX + mapId);
                localStorage.removeItem(STORAGE_STATE_PREFIX + mapId);
            }

            localStorage.removeItem(STORAGE_INDEX);

            this.map = null;
            this.heroCoordinates = null;
            this.currentMapId = null;
            this.currentLocationKey = "camping";
            this.endCombat();
        },
    },
});
