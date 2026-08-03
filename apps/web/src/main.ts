import { createApp } from 'vue';
import App from './App.vue';
import './assets/global.css';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import router from './router';
import { validateContent } from '@hexoflat/engine/content/validate-content';
import { queryClient } from './api/query-client';

if (import.meta.env.DEV) {
  validateContent();
}

const pinia = createPinia();

/**
 * ✅ Safe, minimal Pinia localStorage persistence
 * - Persist ONLY selected stores (whitelist)
 * - Avoid persisting world-map-store because it has its own storage system (hexoflat:world:*)
 * - Avoid persisting ephemeral UI stores (heroTool, overlays, etc.)
 * - Never persist the `user` store: it carries the JWT accessToken, and an
 *   XSS-readable localStorage token is a full session hijack. The token now
 *   only ever lives in memory (api/auth-token.ts) — a page refresh logs the
 *   user out, which is the accepted trade-off until a proper httpOnly-cookie
 *   session exists.
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

app.mount('#app');
