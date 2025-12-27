export const ROUTES = {
    CAMPING: "camping",
    BATTLE: "battle",
} as const;

export type RouteName = typeof ROUTES[keyof typeof ROUTES];
