import type HexMapModel from "@/a-game-scenes/map-scene/models/hex-map-model";
import { HexObjectFactory } from "@/factory/hex-object-factory";
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";

export interface CoinsGeneratorConfig {
    chance: number;         // 0..1
    maxCoinsOnMap: number;  // cap
    minAmount: number;      // мін кількість монет
    maxAmount: number;      // макс кількість монет
    onlyRevealed: boolean;  // генерити тільки на відкритих тайлах
    skipSpawnerTiles: boolean; // не класти монети там, де є resourceSpawner
}

export class CoinsGenerator {
    private readonly map: HexMapModel;
    private readonly cfg: CoinsGeneratorConfig;

    constructor(map: HexMapModel, cfg?: Partial<CoinsGeneratorConfig>) {
        this.map = map;
        this.cfg = {
            chance: 0.05,
            maxCoinsOnMap: 20,
            minAmount: 1,
            maxAmount: 5,
            onlyRevealed: false,
            skipSpawnerTiles: true,
            ...cfg,
        };
    }

    public generate(): boolean {
        // 1) порахувати існуючі монети
        let coinsOnMap = 0;
        for (const t of this.map.tiles) {
            if (t.hexobject?.hexobjectKey === HEXOBJECT_KEYS.COINS) coinsOnMap++;
        }

        if (coinsOnMap >= this.cfg.maxCoinsOnMap) return false;

        // 2) зібрати кандидати (порожні тайли)
        const candidates = this.map.tiles.filter(t => {
            if (this.cfg.onlyRevealed && !t.isRevealed) return false;
            if (t.hexobject) return false;
            return !(this.cfg.skipSpawnerTiles && t.resourceSpawner?.enabled);

        });

        if (!candidates.length) return false;

        let changed = false;

        // 3) пробіг по кандидатах із шансом
        for (const tile of candidates) {
            if (coinsOnMap >= this.cfg.maxCoinsOnMap) break;

            if (Math.random() > this.cfg.chance) continue;

            const amount = randInt(this.cfg.minAmount, this.cfg.maxAmount);

            tile.hexobject = HexObjectFactory.create(
                HEXOBJECT_KEYS.COINS,
                tile.coordinates,
                { amount }
            );

            coinsOnMap++;
            changed = true;
        }

        return changed;
    }
}

function randInt(min: number, max: number): number {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(Math.random() * (b - a + 1)) + a;
}