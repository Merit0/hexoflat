import {DiceFace, DiceModel} from "@/a-game-scenes/battlefield-scene/dice-roller/models/DiceModel";

export class RollDiceTester {
    model: DiceModel;

    constructor(faces: DiceFace[], weights: number[]) {
        this.model = new DiceModel(faces, weights);
    }

    testRolls(times = 1000) {
        const results: Record<string, number> = {};

        for (const face of this.model.faces) {
            results[face] = 0;
        }

        for (let i = 0; i < times; i++) {
            const face = this.model['randomWeightedFace']();
            results[face]++;
        }

        const summary = Object.entries(results).map(([face, count]) => {
            const percent = ((count / times) * 100).toFixed(2) + '%';
            return { face, count, percent };
        });

        console.table(summary);
    }
}
