import {createRouter, createWebHistory} from "vue-router";
import LoginPage from "@/a-game-scenes/login-scene/components/login-page.vue";
import {useUserStore} from "@/stores/user-store";
import HomeLocation from "@/a-game-scenes/home-scene/components/home-location.vue";
import HexWorldMap from "@/a-game-scenes/homeland-scene/components/hex-world-map.vue";

const routes = [
    {path: '/', component: LoginPage},
    {
        path: '/login',
    component: LoginPage
    },
    {
        path: "/camping",
        name: "home-page",
        component: HomeLocation,
        meta: {requiresAuth: true},
    },
    {
        path: "/silesia",
        name: "silesia-world",
        component: HexWorldMap,
        meta: {requiresAuth: true}
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach((to, _, next) => {
    const userStore = useUserStore();
    console.log('Navigating to:', to.path, 'Logged in:', userStore.isUserLoggedIn);
    if (to.meta.requiresAuth && !userStore.isUserLoggedIn) {
        console.log('back to login');
        next('/login');
    } else {
        next();
    }
});

export default router;
