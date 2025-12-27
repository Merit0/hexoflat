import {defineStore} from 'pinia';
import TileModel from '@/a-game-scenes/homeland-scene/models/tile-model';
import EnemyModel from '@/models/EnemyModel';
import {useHeroStore} from './hero-store';
import {useDiceStore} from '@/stores/dice-store';
// import {useMapLocationStore} from '@/stores/map-location-store';
import {useGraveStore} from "@/stores/grave-store";

interface BattleArena {
    tiles: TileModel[];
    battleTile: TileModel | null;
    battleTileId: number | null;
    enemies: EnemyModel[];
    previousHeroTileId: number | null;
    damagePopups: Record<number, number>;
    battleLog: string[];
    bloodSplashTiles: number[];
    missedEnemies: number[];
    isHeroAttacking: boolean;
    _attackLock: boolean,
}

export const useBattleStore = defineStore('battle-store', {
    state: (): BattleArena => ({
        tiles: [] as TileModel[],
        battleTile: null,
        battleTileId: null,
        enemies: [],
        previousHeroTileId: null,
        damagePopups: {} as Record<number, number>,
        battleLog: [] as string[],
        bloodSplashTiles: [] as number[],
        missedEnemies: [] as number[],
        isHeroAttacking: false,
        _attackLock: false,
    }),

    actions: {
        startBattleOnTile(tile: TileModel) {
            tile.inBattle = true;
            const GRID_SIZE = 5;
            const CENTER = {x: 2, y: 2};

            const heroStore = useHeroStore();
            const hero = heroStore.hero;
            const diceStore = useDiceStore();

            this.battleTile = tile;
            this.battleTileId = tile.id;
            this.previousHeroTileId = hero.currentTile?.id ?? null;

            const tiles: TileModel[] = [];
            // for (let y = 0; y < GRID_SIZE; y++) {
            //     for (let x = 0; x < GRID_SIZE; x++) {
            //         const index = y * GRID_SIZE + x;
            //         const t = new TileModel(index, {columnIndex, rowIndex});
            //         tiles.push(t);
            //     }
            // }

            const centerIndex = CENTER.y * GRID_SIZE + CENTER.x;
            tiles[centerIndex].isHeroHere = true;
            hero.currentTile = tiles[centerIndex];

            const used = new Set([`${CENTER.x},${CENTER.y}`]);
            const arenaEnemies = Array.isArray(tile.enemies) ? tile.enemies : [];
            const battleEnemies: EnemyModel[] = [];

            for (const enemy of arenaEnemies) {
                let placed = false;
                let attempts = 0;

                while (!placed && attempts < 100) {
                    const dx = Math.floor(Math.random() * 7) - 3;
                    const dy = Math.floor(Math.random() * 7) - 3;
                    const x = CENTER.x + dx;
                    const y = CENTER.y + dy;
                    const dist = Math.abs(dx) + Math.abs(dy);
                    const key = `${x},${y}`;
                    const index = y * GRID_SIZE + x;

                    if (
                        x >= 0 && x < GRID_SIZE &&
                        y >= 0 && y < GRID_SIZE &&
                        dist >= 2 &&
                        !used.has(key)
                    ) {
                        tiles[index].isEnemyHere = true;
                        tiles[index].setEnemies([enemy]);
                        battleEnemies.push(enemy);
                        used.add(key);
                        placed = true;
                    }

                    attempts++;
                }
            }

            this.tiles = tiles;
            this.enemies = battleEnemies;
            this.enemies.forEach((enemy: EnemyModel) => {
                diceStore.initializeEnemyDice(enemy);
            });
            setTimeout(() => {
                this.enemyAutoAttackLoop();
            }, 500);
        },

        spinHero(durationMs = 1000) {
            if (this._attackLock) return;
            this._attackLock = true;
            this.isHeroAttacking = true;
            setTimeout(() => {
                this.isHeroAttacking = false;
                this._attackLock = false;
            }, durationMs);
        },

        async enemyAutoAttackLoop() {
            const diceStore = useDiceStore();
            const heroStore = useHeroStore();
            const {hero} = heroStore;

            if (hero.currentHealth <= 0) return;

            const results = await diceStore.rollAllEnemyDices();

            this.enemies
                .filter((enemy: EnemyModel) => enemy.health > 0)
                .forEach((enemy: EnemyModel) => {
                    const rolls: string[] = results[enemy.id];
                    if (!rolls) return;

                    this.logEvent(`🎲 ${enemy.name} кидає кубики: [${rolls.join(', ')}]`);

                    const isTripleSword = rolls.every(r => r === 'sword');

                    if (isTripleSword) {
                        const heroTile = this.tiles.find(t => t.isHeroHere);
                        hero.currentHealth = Math.max(0, hero.currentHealth - enemy.attack);
                        this.logEvent(`${enemy.name} ⚔️ hits ${enemy.attack}`);
                        if (heroTile) {
                            this.triggerBloodSplash(heroTile.id);
                            this.showDamagePopup(
                                heroTile.id,
                                enemy.attack
                            );
                        }
                    } else {
                        this.logEvent(`${enemy.name} missed...`);
                    }
                });

            if (hero.currentHealth > 0) {
                setTimeout(() => {
                    this.enemyAutoAttackLoop();
                }, 2000);
            }
        },

        finishBattle() {
            // const mapLocationStore = useMapLocationStore();
            const diceStore = useDiceStore();
            const heroStore = useHeroStore();
            const hero = heroStore.hero;
            // const mapLocation = mapLocationStore.currentLocation;

            const aliveEnemyTiles: TileModel[] = this.tiles.filter((tile: TileModel) => {
                const enemy = tile.enemies[0];
                return enemy && enemy.health > 0;
            });
            this.tiles.forEach((tile: TileModel) => tile.isHeroHere = false);
            if (this.battleTile) {
                const battleTile = this.battleTile;
                if (aliveEnemyTiles.length === 0) {
                    battleTile.enemies = [];
                    battleTile.isEnemyHere = false;
                    if (!battleTile.isDungeon) {
                        // mapLocationStore.moveHero(battleTile);
                    } else {
                        return;
                    }
                } else {
                    // if (this.previousHeroTileId !== null && mapLocation) {
                    if (this.previousHeroTileId !== null) {
                        // const previousTile = mapLocation.tiles.find(t => t.id === this.previousHeroTileId);
                        // if (previousTile) {
                        //     mapLocation.tiles.forEach(t => (t.isHeroHere = false));
                        //
                        //     previousTile.isHeroHere = true;
                        //     hero.currentTile = previousTile;
                        // }
                    }
                    hero.useEnergy(50);
                }
            }

            diceStore.removeDices();
            this.battleLog = [];
            this.tiles = [];
            this.enemies = [];
            this.battleTile = null;
            this.battleTileId = null;
            this.bloodSplashTiles = [];
            this.damagePopups = [];
        },

        showDamagePopup(tileId: number, value: number) {
            this.damagePopups[tileId] = value;
            setTimeout(() => {
                delete this.damagePopups[tileId];
            }, 700);
        },

        triggerBloodSplash(tileId: number) {
            if (!this.bloodSplashTiles.includes(tileId)) {
                this.bloodSplashTiles.push(tileId);
            }

            setTimeout(() => {
                this.bloodSplashTiles = this.bloodSplashTiles.filter((id: number) => id !== tileId);
            }, 1000);
        },

        triggerDodgeEffect(tileId: number) {
            if (!this.missedEnemies.includes(tileId)) {
                this.missedEnemies.push(tileId);
                setTimeout(() => {
                    this.missedEnemies = this.missedEnemies.filter(id => id !== tileId);
                }, 600);
            }
        },

        logEvent(message: string) {
            this.battleLog.push(message);
            if (this.battleLog.length > 30) {
                this.battleLog.shift();
            }
        },

        handleEnemyDeath(enemy: EnemyModel, tile: TileModel) {
            const graveStore = useGraveStore();

            // tile.grave = graveStore.generateGraveFromEnemy(enemy);
            tile.isGrave = true;
            tile.enemies = tile.enemies.filter(e => e !== enemy);
        }
    },
});
