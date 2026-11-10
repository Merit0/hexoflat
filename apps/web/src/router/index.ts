import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useUserStore } from '@/stores/user-store';

const LoginPage = () => import('@/a-game-scenes/login-scene/components/login-view.vue');
const HexWorldMap = () => import('@/a-game-scenes/map-scene/components/hex-world-map.vue');
const DevBattlefieldPage = import.meta.env.DEV
  ? () => import('@/a-game-scenes/battle-scene/components/dev-battlefield-page.vue')
  : null;

export const ROUTES = {
  LOGIN: 'login',
  REGISTER: 'register',
  WORLD: 'world',
  BATTLE: 'battle',
  DEV_BATTLEFIELD: 'dev-battlefield',
} as const;

const DEV_ROUTES: RouteRecordRaw[] =
  import.meta.env.DEV && DevBattlefieldPage
    ? [
        {
          path: '/dev/battlefield',
          name: ROUTES.DEV_BATTLEFIELD,
          component: DevBattlefieldPage,
          meta: { requiresAuth: false },
        },
      ]
    : [];

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
    path: '/register',
    name: ROUTES.REGISTER,
    redirect: { name: ROUTES.LOGIN, query: { mode: 'new' } },
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
  ...DEV_ROUTES,
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
