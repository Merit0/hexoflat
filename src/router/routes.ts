export const ROUTES = {
    BATTLE: "battle",
    WORLD: "world",
} as const;

export type RouteName = typeof ROUTES[keyof typeof ROUTES];