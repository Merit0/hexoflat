import { createApp } from "vue";
import App from "./App.vue";
import "./assets/global.css";
import { createPinia } from "pinia";
import router from "./router";

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
        "user",
        "hero",
        // "settings", // example
    ]);

    if (!PERSIST_STORES.has(storeId)) return;

    // --- hydrate ---
    try {
        const raw = window.localStorage.getItem(storeId);
        if (raw) {
            const fromLocalStorage = serializer.deserialize(raw);
            if (fromLocalStorage && typeof fromLocalStorage === "object") {
                context.store.$patch(fromLocalStorage);
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

createApp(App)
    .use(router)
    .use(pinia)
    .mount("#app");