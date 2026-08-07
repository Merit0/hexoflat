import { defineStore } from 'pinia';
import {
  fetchSession,
  login as loginRequest,
  register as registerRequest,
  type AuthResponse,
} from '../api/Requests';
import { ApiError, type ApiValidationIssue } from '../api/client';
import { setAuthToken } from '../api/auth-token';
import UserModel from '@hexoflat/engine/models/user-model';
import router, { ROUTES } from '../router';
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
    // Applies a login/register/session-restore response to store state —
    // shared so the three call sites can't drift out of sync.
    //
    // `clearPriorSession` must be false for restoreSession(): it's the same
    // person's session continuing (not a new one starting), so wiping
    // `hero` here would blow away the world-map-store position/inventory
    // data that lives under that key (see main.ts's persist whitelist) —
    // i.e. every refresh would silently reset the hero back to the map
    // entry point, right after the httpOnly-cookie fix that was supposed to
    // stop refresh from losing anything at all. login()/register() still
    // want the clear: a genuinely new session starting should not inherit
    // whatever the previous user (on a shared device) left behind.
    async applyAuthResult(
      { user: userFromApi, accessToken }: AuthResponse,
      { clearPriorSession }: { clearPriorSession: boolean },
    ): Promise<void> {
      this.user
        .setName(userFromApi.name)
        .setUsername(userFromApi.username)
        .setId(userFromApi.id)
        .setLoggedIn(true);
      this.accessToken = accessToken;
      setAuthToken(accessToken);

      if (clearPriorSession) {
        clearSessionStorage();
      }
      localStorage.setItem('uStatus', 'true');

      const heroStore = useHeroStore();
      await heroStore.getHero();
    },
    async login(username: string, password: string, rememberMe = true) {
      try {
        const authResult = await loginRequest({ username, password, rememberMe });
        await this.applyAuthResult(authResult, { clearPriorSession: true });

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
        const authResult = await registerRequest({ username, password, name });
        await this.applyAuthResult(authResult, { clearPriorSession: true });

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
    // Silent restore on app boot via the httpOnly session cookie — see
    // main.ts. A failed restore (logged-out visitor, or a network error) is
    // expected, not a user-facing error, so it never touches `this.error`.
    async restoreSession(): Promise<boolean> {
      try {
        const authResult = await fetchSession();
        await this.applyAuthResult(authResult, { clearPriorSession: false });
        return true;
      } catch {
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

        // Skip the redirect when already on a public auth screen (/login or
        // /register) — login-form.vue's onMounted calls logout() on every
        // mount to defensively clear stale session state, and forcing
        // /login here would stomp a direct visit/reload of /register right
        // back to /login (both routes render the same component).
        const currentRouteName = router.currentRoute.value.name;
        if (currentRouteName !== ROUTES.LOGIN && currentRouteName !== ROUTES.REGISTER) {
          try {
            await router.push('/login');
          } catch (e) {
            console.error('Router push failed during logout:', e);
          }
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
