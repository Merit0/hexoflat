import HexMapModel from "@/a-game-scenes/map-scene/models/hex-map-model";
import { HexTileModel } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import type { IHexCoordinates } from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import type { IHexMapPlacement } from "@/abstraction/hex-map-placement";
import { coordinateKey, getOddQNeighbors } from "@/utils/hex-utils";
import {IWorldGenerator} from "@/abstraction/world-generator-interface";
import {HexObjectFactory} from "@/factory/hex-object-factory";
import {THexobjectKey} from "@/registry/hexobjects-registry";
import {EHexobjectGroup} from "@/abstraction/hexobject-abstraction";

export class WorldGenerator {
    constructor(private readonly generator: IWorldGenerator) {}

    generate(): HexMapModel {
        const map = new HexMapModel();

        map.name = this.generator.worldName;
        map.width = this.generator.worldWidth;
        map.height = this.generator.worldHeight;
        map.complexity = this.generator.worldComplexity;
        map.config = this.generator.config;

        (map as any).safeZoneRadius = this.generator.safeZoneRadius ?? 1;

        map.tiles = this.buildBaseGrid(map.width, map.height);

        this.applyConfig(map);

        this.applySafeZoneAroundEntry(map);

        return map;
    }

    private buildBaseGrid(width: number, height: number): HexTileModel[] {
        const tiles: HexTileModel[] = [];

        for (let r = 0; r < height; r++) {
            for (let q = 0; q < width; q++) {
                const t = new HexTileModel();
                t.tileId = `${q}:${r}`;
                t.coordinates = { columnIndex: q, rowIndex: r };
                t.isRevealed = false;
                t.hexobject = null;
                tiles.push(t);
            }
        }

        return tiles;
    }

    private applyConfig(map: HexMapModel) {
        if (!map.config?.length) return;

        const byKey = new Map<string, HexTileModel>();
        for (const t of map.tiles) byKey.set(coordinateKey(t.coordinates), t);

        for (const placement of map.config) {
            for (const c of placement.coordinates) {
                const tile = byKey.get(coordinateKey(c));
                if (!tile) continue;

                if (placement.initialTileImage) {
                    (tile as any).initialTileImage = placement.initialTileImage;
                }

                if (placement.hexobject?.hexobjectKey) {
                    tile.hexobject = HexObjectFactory.create(
                        placement.hexobject.hexobjectKey as THexobjectKey,
                        tile.coordinates,
                        placement.hexobject.overrides
                    );
                }
            }
        }
    }

    private applySafeZoneAroundEntry(map: HexMapModel) {
        const radius = this.generator.safeZoneRadius ?? 0;
        if (radius <= 0) return;

        const entryCoord = this.pickEntryCoordFromConfig(map.config);
        if (!entryCoord) {
            console.warn("[WorldGenerator] No DEFAULT entry defined in map config. Safe-zone skipped.");
            return;
        }

        const byKey = new Map<string, HexTileModel>();
        for (const t of map.tiles) byKey.set(coordinateKey(t.coordinates), t);

        const entryTile = byKey.get(coordinateKey(entryCoord));
        if (!entryTile) return;

        const visited = new Set<string>();
        let frontier: IHexCoordinates[] = [entryTile.coordinates];

        for (let step = 0; step < radius; step++) {
            const next: IHexCoordinates[] = [];

            for (const c of frontier) {
                const neighbors = getOddQNeighbors(c);

                for (const n of neighbors) {
                    const k = coordinateKey(n);
                    if (visited.has(k)) continue;
                    visited.add(k);

                    const tile = byKey.get(k);
                    if (!tile) continue;

                    if (
                        tile.coordinates.columnIndex === entryTile.coordinates.columnIndex &&
                        tile.coordinates.rowIndex === entryTile.coordinates.rowIndex
                    ) {
                        continue;
                    }
                    if (tile.hexobject?.groupType === EHexobjectGroup.CONSTRUCTION) {
                        continue;
                    }

                    tile.hexobject = null;

                    if ((tile as any).resourceSpawner) (tile as any).resourceSpawner = null;
                    if ((tile as any).pendingAction) (tile as any).pendingAction = null;

                    next.push(n);
                }
            }

            frontier = next;
            if (!frontier.length) break;
        }
    }

    private pickEntryCoordFromConfig(config: IHexMapPlacement[] | undefined): IHexCoordinates | null {
        if (!config?.length) return null;

        const def = config.find(p => p.entry?.type === "DEFAULT");
        if (def?.coordinates?.length) return def.coordinates[0];

        const secret = config.find(p => p.entry?.type === "SECRET");
        if (secret?.coordinates?.length) return secret.coordinates[0];

        return null;
    }
}