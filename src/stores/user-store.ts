import {defineStore} from 'pinia';
import * as Request from '../api/Requests';
import UserModel from "@/models/UserModel";
import router from "../router";
import {useHeroStore} from "./hero-store";
import {HexMapProvider} from "@/a-game-scenes/silesia-world-scene/providers/hex-map-provider";
import {HexMapModel} from "@/a-game-scenes/silesia-world-scene/models/hex-map-model";

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
            console.log('Logout initiated');
            const heroStore = useHeroStore();

            // mapLocationStore.initMapsList();
            const homeland: HexMapModel = HexMapProvider.getHomeLand();

            if (homeland) {
                try {
                    // await Promise.all([
                    //     mapLocationStore.resetAllMapLocations(silesiaMap),
                    //     bagStore.resetBag(),
                    // ]);

                    localStorage.clear();
                    localStorage.setItem('uStatus', 'false');
                    this.user.setLoggedIn(false);
                    await router.push('/login');
                } catch (error) {
                    console.error("Error during logout:", error);
                }
            } else {
                console.error('Silesia map not found');
            }
            heroStore.resetHero();
            localStorage.clear();
        },
        async clearErrorMsg() {
            this.error = '';
        },
    },
});