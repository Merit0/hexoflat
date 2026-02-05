export const HEXOBJECT_KEYS = {
    TREE: "tree",
    COINS: "coins",
    ROCK: "rock",
    SKELETOR: "skeletor",
    AXE: "axe",
    CAMPING_ENTRANCE: "camping-entrance",
    HOMELAND_GATE: "homeland-gate",
} as const;

export type THexobjectKey = typeof HEXOBJECT_KEYS[keyof typeof HEXOBJECT_KEYS];