export const HEXOBJECT_KEYS = {
    TREE: "tree",
    COINS: "coins",
    ROCK: "rock",
    SKELETOR: "skeletor",
    EMITTER: "emitter",
    INFERNO: "inferno",
    AXE: "axe",
    CAMPING_ENTRANCE: "camping-entrance",
    HOMELAND_GATE: "homeland-gate",
    HEALTH_BOTTLE: "health-bottle",
    ENERGY_BOTTLE: "energy-bottle",
    MANA_BOTTLE: "mana-bottle",
    FIREPLACE: "fireplace",
} as const;

export type THexobjectKey = typeof HEXOBJECT_KEYS[keyof typeof HEXOBJECT_KEYS];