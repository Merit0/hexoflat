import { createApp } from 'vue'
import App from './App.vue'
import './assets/global.css'
import { createPinia } from 'pinia'
import router from "./router";

const pinia = createPinia();
const app = createApp(App);

app
    .use(router)
    .use(pinia)
    .mount('#app');

pinia.use((context) => {

    const serializer = {
        serialize: JSON.stringify,
        deserialize: JSON.parse,
    };

    const storeId = context.store.$id;

    const fromLocalStorage = serializer.deserialize(window.localStorage.getItem(storeId));

    if (fromLocalStorage) {
        context.store.$patch(fromLocalStorage);
    }

    context.store.$subscribe((_, state) => {
        window.localStorage.setItem(storeId, serializer.serialize(state));
    })
})
