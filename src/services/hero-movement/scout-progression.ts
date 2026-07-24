export type ScoutRank = {
    minSteps: number;
    rank: number;
    title: string;
};

export type ScoutProgress = {
    current: ScoutRank;
    next: ScoutRank | null;
    steps: number;
    moveSteps: number;
    rankLabel: string;
    nextRankAt: number | null;
};

export const SCOUT_RANKS: ScoutRank[] = [
    { minSteps: 0, rank: 1, title: "Novice Pathfinder" },
    { minSteps: 100, rank: 2, title: "Seeker of Trails" },
    { minSteps: 200, rank: 3, title: "Woodland Scout" },
    { minSteps: 350, rank: 4, title: "Knower of Paths" },
    { minSteps: 450, rank: 5, title: "Boundary Guide" },
    { minSteps: 600, rank: 6, title: "Explorer of the Wild Lands" },
    { minSteps: 800, rank: 7, title: "Master of Trails" },
    { minSteps: 1050, rank: 8, title: "Cartographer of Horizons" },
    { minSteps: 1350, rank: 9, title: "Warden of the Horizon" },
    { minSteps: 1700, rank: 10, title: "Legendary Scout" },
];

function toRoman(rank: number): string {
    const numerals: Array<[number, string]> = [
        [10, "X"],
        [9, "IX"],
        [5, "V"],
        [4, "IV"],
        [1, "I"],
    ];

    let value = Math.max(1, Math.floor(rank));
    let result = "";

    for (const [amount, symbol] of numerals) {
        while (value >= amount) {
            result += symbol;
            value -= amount;
        }
    }

    return result;
}

export function getScoutProgress(steps: number, ranks = SCOUT_RANKS): ScoutProgress {
    const safeSteps = Math.max(0, Math.floor(steps || 0));
    let current = ranks[0];
    let next: ScoutRank | null = null;

    for (let index = 0; index < ranks.length; index++) {
        const rank = ranks[index];
        if (safeSteps >= rank.minSteps) {
            current = rank;
            next = ranks[index + 1] ?? null;
        }
    }

    return {
        current,
        next,
        steps: safeSteps,
        moveSteps: current.rank,
        rankLabel: `Scout Rank ${toRoman(current.rank)} — ${current.title}`,
        nextRankAt: next?.minSteps ?? null,
    };
}

export function getScoutMoveStepsForSteps(steps: number, ranks = SCOUT_RANKS): number {
    return getScoutProgress(steps, ranks).moveSteps;
}

export function getScoutRadiusForSteps(steps: number, ranks = SCOUT_RANKS): number {
    return getScoutMoveStepsForSteps(steps, ranks);
}
