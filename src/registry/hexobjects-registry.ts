export const HEXOBJECT_KEYS = {
    TREE: "tree",
    COINS: "coins",
    ROCK: "rock",
    SKELETOR: "skeletor",
    AXE: "axe",
    CAMPING: "camping",
} as const;

export type THexobjectKey = typeof HEXOBJECT_KEYS[keyof typeof HEXOBJECT_KEYS];