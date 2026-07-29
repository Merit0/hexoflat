export type DiceFace = 'sword' | 'shield' | 'energy' | 'coin' | `x${number}`;

export class DiceModel {
    face: DiceFace | string = 'sword';
    isRolling = false;
    faces: DiceFace[] | string[] = [];
    weights: number[] = [];

    constructor(
        faces: DiceFace[] | string[],
        weights?: number[],
    ) {
        this.faces = faces;

        this.weights = weights && weights.length === faces.length
            ? weights
            : Array(faces.length).fill(1);
    }

    roll(): Promise<DiceFace | string> {
        this.isRolling = true;

        return new Promise(resolve => {
            const interval = setInterval(() => {
                this.face = this.randomWeightedFace();
            }, 100);

            setTimeout(() => {
                clearInterval(interval);
                const result: string = this.randomWeightedFace();
                this.face = result;
                this.isRolling = false;
                resolve(result);
            }, 1500);
        });
    }

    private randomWeightedFace(): string {
        const total = this.weights.reduce((sum, w) => sum + w, 0);
        const rand = Math.random() * total;

        let acc = 0;
        for (let i = 0; i < this.faces.length; i++) {
            acc += this.weights[i];
            if (rand < acc) return this.faces[i];
        }

        return this.faces[0];
    }
}