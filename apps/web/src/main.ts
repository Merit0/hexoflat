import { createApp } from 'vue';
import App from './App.vue';
import './assets/global.css';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import router from './router';
import { validateContent } from '@hexoflat/engine/content/validate-content';
import { queryClient } from './api/query-client';
import { useUserStore } from './stores/user-store';
import { i18n } from './i18n';

if (import.meta.env.DEV) {
  validateContent();
}

const pinia = createPinia();

/**
 * Persists only the `hero` store to localStorage — world-map-store isn't
 * included because it has its own storage system (hexoflat:world:*). Never
 * persist the `user` store: it carries the JWT accessToken, and an
 * XSS-readable localStorage token is a full session hijack. The token still
 * only ever lives in memory (api/auth-token.ts). A page refresh instead
 * survives via a silent `GET /auth/session` call against an httpOnly,
 * JS-unreadable cookie set at login/register (see user-store.ts's
 * `restoreSession`) — the raw token never touches localStorage either way.
 */
pinia.use((context) => {
  const serializer = {
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  };

  const storeId = context.store.$id;

  const PERSIST_STORES = new Set<string>(['hero']);

  if (!PERSIST_STORES.has(storeId)) return;

  try {
    const raw = window.localStorage.getItem(storeId);
    if (raw) {
      const fromLocalStorage: unknown = serializer.deserialize(raw);
      if (fromLocalStorage && typeof fromLocalStorage === 'object') {
        context.store.$patch(fromLocalStorage as Partial<typeof context.store.$state>);
      }
    }
  } catch (e) {
    console.warn(`[pinia-persist] failed to hydrate "${storeId}"`, e);
    window.localStorage.removeItem(storeId);
  }

  context.store.$subscribe((_, state) => {
    try {
      window.localStorage.setItem(storeId, serializer.serialize(state));
    } catch (e) {
      console.warn(`[pinia-persist] failed to persist "${storeId}"`, e);
    }
  });
});

const app = createApp(App);

app.use(pinia);
app.use(i18n);

// vue-router's `install()` kicks off the initial navigation (and its
// `beforeEach` guard reading `userStore.isUserLoggedIn`) the moment
// `app.use(router)` runs — NOT deferred until `app.mount()`. So the restore
// attempt has to finish and land in the store *before* router is installed;
// otherwise the guard fires against a still-logged-out store, redirects to
// /login, and login-form.vue's `onMounted` then calls `userStore.logout()`
// unconditionally — wiping the session this very call just restored.
try {
  await useUserStore().restoreSession();
} catch {
  // no session — proceed logged out, same as today
}

app.use(router);
app.use(VueQueryPlugin, { queryClient });
app.mount('#app');
