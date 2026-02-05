import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useUserStore } from "@/stores/user-store";

// lazy-load
const LoginPage = () => import("@/a-game-scenes/login-scene/components/login-page.vue");
const HexWorldMap = () => import("@/a-game-scenes/map-scene/components/hex-world-map.vue");
// const BattlePage = () => import("@/a-game-scenes/battle-scene/components/battle-page.vue"); // якщо є

export const ROUTES = {
    LOGIN: "login",

    // ✅ Single world route (all maps inside)
    WORLD: "world",

    BATTLE: "battle",
} as const;

export type RouteName = typeof ROUTES[keyof typeof ROUTES];

const routes: RouteRecordRaw[] = [
    {
        path: "/",
        redirect: "/login",
    },
    {
        path: "/login",
        name: ROUTES.LOGIN,
        component: LoginPage,
        meta: { requiresAuth: false },
    },

    /**
     * ✅ World scene (camping / homeland / ...)
     * location перемикається через worldStore.goToLocation()
     */
    {
        path: "/world",
        name: ROUTES.WORLD,
        component: HexWorldMap,
        meta: { requiresAuth: true },
    },

    {
        path: "/battle",
        name: ROUTES.BATTLE,
        component: null, // TODO: заміниш на BattlePage коли буде
        meta: { requiresAuth: true },
    },

    {
        path: "/:pathMatch(.*)*",
        redirect: { name: ROUTES.LOGIN },
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach((to) => {
    const userStore = useUserStore();

    if (to.meta.requiresAuth && !userStore.isUserLoggedIn) {
        return { name: ROUTES.LOGIN };
    }

    return true;
});

export default router;