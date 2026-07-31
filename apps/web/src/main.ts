import { createApp } from 'vue';
import App from './App.vue';
import './assets/global.css';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import router from './router';
import { validateContent } from '@hexoflat/engine/content/validate-content';
import { queryClient } from './api/query-client';
import { setAuthToken } from './api/auth-token';
import { useUserStore } from './stores/user-store';

if (import.meta.env.DEV) {
  validateContent();
}

const pinia = createPinia();

/**
 * ✅ Safe, minimal Pinia localStorage persistence
 * - Persist ONLY selected stores (whitelist)
 * - Avoid persisting world-map-store because it has its own storage system (hexoflat:world:*)
 * - Avoid persisting ephemeral UI stores (heroTool, overlays, etc.)
 */
pinia.use((context) => {
  const serializer = {
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  };

  const storeId = context.store.$id;

  // ✅ Persist only what you really need
  // Add more ids here ONLY if you are sure the store is safe to persist.
  const PERSIST_STORES = new Set<string>([
    'user',
    'hero',
    // "settings", // example
  ]);

  if (!PERSIST_STORES.has(storeId)) return;

  // --- hydrate ---
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

const app = createApp(App).use(router).use(pinia).use(VueQueryPlugin, { queryClient });

// Seed the in-memory token holder (api/auth-token.ts) from the just-hydrated
// user store, synchronously, before mounting — api/client.ts reads from
// there, not from localStorage directly, to avoid racing the persist plugin's
// async flush on the very first request after login/register.
setAuthToken(useUserStore(pinia).accessToken);

app.mount('#app');
