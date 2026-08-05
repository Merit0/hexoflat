import { defineStore } from 'pinia';
import { login as loginRequest, register as registerRequest } from '../api/Requests';
import { ApiError, type ApiValidationIssue } from '../api/client';
import { setAuthToken } from '../api/auth-token';
import UserModel from '@hexoflat/engine/models/user-model';
import router from '../router';
import { useHeroStore } from './hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useOverlayStore } from '@/stores/overlay-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';

// ✅ Тільки ключі гри/сесії користувача. НЕ чіпаємо device-level UI-налаштування
// (наприклад "hexoflat:ui-settings:v1"), бо вони мають переживати логін/логаут.
const SESSION_STORAGE_KEYS = ['user', 'hero'];

function clearSessionStorage() {
  for (const key of SESSION_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

function describeValidationError(error: ApiError): string | null {
  const issues = error.body?.message;
  if (!Array.isArray(issues)) return null;

  const messages = issues
    .map((issue: ApiValidationIssue) => issue.message)
    .filter((message): message is string => !!message);

  return messages.length ? messages.join(' ') : null;
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: new UserModel().build(),
    accessToken: null as string | null,
    error: '',
  }),
  getters: {
    isLoggedIn: (): boolean => localStorage.getItem('uStatus') === 'true',
    isUserLoggedIn(): boolean {
      return this.user.getStatus();
    },
  },
  actions: {
    async login(username: string, password: string) {
      try {
        const { user: userFromApi, accessToken } = await loginRequest({ username, password });

        this.user
          .setName(userFromApi.name)
          .setUsername(userFromApi.username)
          .setId(userFromApi.id)
          .setLoggedIn(true);
        this.accessToken = accessToken;
        setAuthToken(accessToken);

        clearSessionStorage();
        localStorage.setItem('uStatus', 'true');

        const heroStore = useHeroStore();
        await heroStore.getHero();

        this.error = '';
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          this.error = `${username} is not found.`;
        } else if (error instanceof ApiError && error.status === 400) {
          this.error = describeValidationError(error) ?? 'Invalid username or password.';
        } else {
          console.error('Login failed:', error);
          this.error = 'Login failed. Please check your connection and try again.';
        }
        return false;
      }
    },
    async register(username: string, password: string, name: string) {
      try {
        const { user: userFromApi, accessToken } = await registerRequest({
          username,
          password,
          name,
        });

        this.user
          .setName(userFromApi.name)
          .setUsername(userFromApi.username)
          .setId(userFromApi.id)
          .setLoggedIn(true);
        this.accessToken = accessToken;
        setAuthToken(accessToken);

        clearSessionStorage();
        localStorage.setItem('uStatus', 'true');

        const heroStore = useHeroStore();
        await heroStore.getHero();

        this.error = '';
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          this.error = `Username "${username}" is already taken.`;
        } else if (error instanceof ApiError && error.status === 400) {
          this.error = describeValidationError(error) ?? 'Invalid registration details.';
        } else {
          console.error('Registration failed:', error);
          this.error = 'Registration failed. Please check your connection and try again.';
        }
        return false;
      }
    },
    async logout(): Promise<void> {
      const heroStore = useHeroStore();
      const worldMapStore = useWorldMapStore();
      const overlayStore = useOverlayStore();
      const heroInventoryStore = useHeroInventoryStore();

      try {
        this.user.setLoggedIn(false);
        this.accessToken = null;
        setAuthToken(null);
      } catch (error) {
        console.error('Error during logout:', error);
      } finally {
        overlayStore.closeOverlay();
        worldMapStore.clearAllWorlds();
        heroStore.resetHero();
        heroInventoryStore.clearPersistence();

        clearSessionStorage();
        localStorage.setItem('uStatus', 'false');

        try {
          await router.push('/login');
        } catch (e) {
          console.error('Router push failed during logout:', e);
        }
      }
    },
    clearErrorMsg() {
      this.error = '';
    },
    setError(message: string) {
      this.error = message;
    },
  },
});
