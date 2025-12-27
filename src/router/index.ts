import {createRouter, createWebHistory, type RouteRecordRaw} from "vue-router";
import {useUserStore} from "@/stores/user-store";

// lazy-load
const LoginPage = () => import("@/a-game-scenes/login-scene/components/login-page.vue");
const HomeLocation = () => import("@/a-game-scenes/home-scene/components/home-location.vue");
const HexWorldMap = () => import("@/a-game-scenes/homeland-scene/components/hex-world-map.vue");

export const ROUTES = {
    LOGIN: "login",
    CAMPING: "camping",
    BATTLE: "battle",
    SILESIA_WORLD: "silesia-world",
} as const;

export type RouteName = typeof ROUTES[keyof typeof ROUTES];

const routes: RouteRecordRaw[] = [
    {
        path: "/",
        redirect: "/login", // без логіки тут
    },
    {
        path: "/login",
        name: ROUTES.LOGIN,
        component: LoginPage,
        meta: {requiresAuth: false},
    },

    {
        path: "/camping",
        name: ROUTES.CAMPING,
        component: HomeLocation,
        meta: {requiresAuth: true},
    },

    {
        path: "/silesia",
        name: ROUTES.SILESIA_WORLD,
        component: HexWorldMap,
        meta: {requiresAuth: true},
    },
    {
        path: "/battle",
        name: ROUTES.BATTLE,
        component: null,
        meta: {requiresAuth: true},
    },
    {
        path: "/:pathMatch(.*)*",
        redirect: {name: ROUTES.LOGIN},
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach((to) => {
    const userStore = useUserStore();

    if (to.meta.requiresAuth && !userStore.isUserLoggedIn) {
        return {name: ROUTES.LOGIN};
    }

    return true;
});

export default router;