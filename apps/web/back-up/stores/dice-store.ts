import {defineStore} from 'pinia';
import {DicesHolderModel} from '../../back-up/scenes/battlefield-scene/dice-roller/models/DicesHolderModel';
import {DiceFace, DiceModel} from "../../back-up/scenes/battlefield-scene/dice-roller/models/DiceModel";
import {RollDiceTester} from "@/utils/roll-dice-tester";
import {EnemyDiceGenerator} from "@/utils/enemy-utils/enemy-dice-generator";
import EnemyModel from "@/models/EnemyModel";
import {useHeroStore} from "@/stores/hero-store";

export const useDiceStore = defineStore('dice', {
        state: () => ({
            holder: new DicesHolderModel(),
            enemyDiceHolders: {} as Record<number, DiceModel[]>,
            lastResult: [] as string[],
            isRolling: false,
        }),
        actions: {
            initializeEnemyDice(enemy: EnemyModel) {
                this.enemyDiceHolders[enemy.id] = EnemyDiceGenerator.generate(enemy);
            },
            async rollDices(currentEnemies: { health: number }[]) {
                this.isRolling = true;
                const liveEnemies = currentEnemies.filter(e => e.health > 0);
                const enemyFaces = Array.from({length: liveEnemies.length}, (_, i) => `x${i + 1}`);

                const enemyDice = this.holder.dices[3];
                if (enemyDice) {
                    enemyDice.faces = enemyFaces;
                }

                this.lastResult = await this.holder.rollAll();
                await new Promise(resolve => setTimeout(resolve, 1000));

                this.isRolling = false;
            },

            async rollAllEnemyDices(): Promise<Record<number, string[]>> {
                const results: Record<number, string[]> = {};

                for (const [idStr, dices] of Object.entries(this.enemyDiceHolders) as [string, any[]][]) {
                    const restoredDices = dices.map((d: any) => {
                        if (typeof d.roll !== 'function') {
                            const restored = new DiceModel(d.faces, d.weights);
                            restored.face = d.face;
                            return restored;
                        }
                        return d;
                    });

                    this.enemyDiceHolders[+idStr] = restoredDices;
                    results[+idStr] = await Promise.all(restoredDices.map(d => d.roll()));
                }

                return results;
            },

            setupDiceHeroActions() {
                const hero = useHeroStore().hero;
                const heroDices = hero.getHeroDices();
                this.testDice(heroDices[0].faces, heroDices[0].weights);

                this.holder.dices = [
                    new DiceModel(heroDices[0].faces, heroDices[0].weights),
                    new DiceModel(heroDices[1].faces, heroDices[1].weights),
                    new DiceModel(heroDices[2].faces, heroDices[2].weights),
                ];
            },

            setupEnemyCounterDice(enemyModels: { health: number }[]) {
                const liveEnemies = enemyModels.filter(e => e.health > 0);
                const liveEnemyCount = liveEnemies.length;
                const enemyFaces = Array.from({length: liveEnemyCount}, (_, i) => `x${i + 1}`);
                if (this.holder.dices.length === 3) {
                    this.holder.dices.push(new DiceModel(enemyFaces));// dynamic dice with enemy counter
                } else {
                    console.warn('Three Hero Action Dices are not added!')
                }
            },

            restoreState(saved: any) {
                if (saved?.holder?.dices?.length > 0) {
                    this.holder = DicesHolderModel.fromSaved(saved.holder);
                } else {
                    this.holder = new DicesHolderModel();
                }

                if (Array.isArray(saved.lastResult)) {
                    this.lastResult = saved.lastResult;
                }

                this.isRolling = false;
            },
            removeDices() {
                this.holder.dices = [];
                this.lastResult = [];
                this.isRolling = false;
            },
            testDice(faces: DiceFace[], weights: number[]) {
                new RollDiceTester(faces, weights).testRolls(1000);
            },
            persist: {
                paths: ['holder.dices', 'lastResult'],
            },
        },
    })
;