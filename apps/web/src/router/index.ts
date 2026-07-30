import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useUserStore } from '@/stores/user-store';

const LoginPage = () => import('@/a-game-scenes/login-scene/components/login-page.vue');
const HexWorldMap = () => import('@/a-game-scenes/map-scene/components/hex-world-map.vue');

export const ROUTES = {
  LOGIN: 'login',
  WORLD: 'world',
  BATTLE: 'battle',
} as const;

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: ROUTES.LOGIN,
    component: LoginPage,
    meta: { requiresAuth: false },
  },
  {
    path: '/world/:locationKey?',
    name: ROUTES.WORLD,
    component: HexWorldMap,
    props: (route) => ({
      locationKey: (route.params.locationKey as string | undefined) || 'camping',
    }),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
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
