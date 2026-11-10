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
import { writeBlob } from './services/persistence/world-blob-store';
import { HERO_STORE_BLOB } from './stores/hero-store-blob';

if (import.meta.env.DEV) {
  validateContent();
}

const pinia = createPinia();

/**
 * The `hero` store (where the hero stands, his health, the portal link) belongs to his expedition,
 * so it is kept with the server's copy of the world (`world-blob-store`, key `hero-store`) and
 * restored by `hero-store.getHero()` once the expedition is loaded. Never persist the `user`
 * store: it carries the JWT accessToken, which only ever lives in memory (api/auth-token.ts); a
 * page refresh survives via a silent `GET /auth/session` call against an httpOnly cookie.
 */
pinia.use((context) => {
  if (context.store.$id !== 'hero') return;

  context.store.$subscribe((_, state) => {
    try {
      writeBlob(
        HERO_STORE_BLOB,
        JSON.stringify(
          Object.fromEntries(
            Object.entries(state).filter(([key]) => !['knowledge', 'knowledgeError'].includes(key)),
          ),
        ),
      );
    } catch (e) {
      console.warn('[pinia-persist] failed to persist "hero"', e);
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
