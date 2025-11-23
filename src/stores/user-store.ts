import {defineStore} from 'pinia';
import * as Request from '../api/Requests';
import UserModel from "@/models/UserModel";
import router from "../router";
import {useHeroStore} from "./hero-store";
import {HexMapProvider} from "@/a-game-scenes/homeland-scene/providers/hex-map-provider";
import {HexMapModel} from "@/a-game-scenes/homeland-scene/models/hex-map-model";
import {useWorldMapStore} from "@/stores/world-map-store";

export const useUserStore = defineStore('user', {
    state: () => ({
        user: new UserModel().build(),
        error: '',
    }),
    getters: {
        isLoggedIn: (): boolean => localStorage.getItem('uStatus') === 'true',
        isUserLoggedIn(): boolean {
            return this.user.getStatus();
        }
    },
    actions: {
        async login(username: string, password: string) {
            const userFromApi = await Request.login(username, password);
            if (userFromApi == null) {
                this.error = `${username} is not found.`;
                return false;
            }
            this.user
                .setName(userFromApi.name)
                .setUsername(userFromApi.username)
                .setId(userFromApi.id)
                .setLoggedIn(true);

            localStorage.clear();
            localStorage.setItem('uStatus', 'true');

            const heroStore = useHeroStore();
            await heroStore.getHero();

            this.error = '';
            await router.push('/camping');
            return true;
        },
        async logout(): Promise<void> {
            console.log("Logout initiated");

            const heroStore = useHeroStore();
            const worldMapStore = useWorldMapStore();

            try {
                // await Request.logout() ...

                this.user.setLoggedIn(false);
            } catch (error) {
                console.error("Error during logout:", error);
            } finally {
                worldMapStore.clearWorld();
                heroStore.resetHero();
                // bagStore.resetBag();

                localStorage.clear();
                localStorage.setItem("uStatus", "false");

                try {
                    await router.push("/login");
                } catch (e) {
                    console.error("Router push failed during logout:", e);
                }
            }
        },
        async clearErrorMsg() {
            this.error = '';
        },
    },
});