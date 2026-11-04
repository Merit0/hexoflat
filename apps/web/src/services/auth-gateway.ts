import { useUserStore } from '@/stores/user-store';
import type { Grade } from '@/features/auth/logic/grade-colors';

export type AuthFailureKind = 'credentials' | 'taken' | 'validation' | 'network' | 'unavailable';

export type AuthResult =
  { ok: true; name: string } | { ok: false; kind: AuthFailureKind; message: string };

export class AuthNotAvailableError extends Error {
  constructor() {
    super('This sign-in method is not available yet.');
    this.name = 'AuthNotAvailableError';
  }
}

export interface AuthGateway {
  startFresh(): Promise<void>;
  signIn(input: { name: string; password: string; remember: boolean }): Promise<AuthResult>;
  signUp(input: {
    name: string;
    password: string;
    grade?: Grade;
    guardianEmail?: string;
  }): Promise<AuthResult>;
  signInWithRunes(input: {
    name: string;
    runes: [string, string, string, string];
  }): Promise<AuthResult>;
  signInWithPasskey(input: { name?: string }): Promise<AuthResult>;
}

export function createAuthGateway(): AuthGateway {
  const userStore = useUserStore();

  const settle = (success: boolean, name: string): AuthResult => {
    if (success) return { ok: true, name };
    return { ok: false, kind: userStore.errorKind ?? 'network', message: userStore.error };
  };

  return {
    async startFresh() {
      userStore.clearErrorMsg();
      await userStore.logout();
    },
    async signIn({ name, password, remember }) {
      return settle(await userStore.login(name, password, remember), name);
    },
    async signUp({ name, password }) {
      return settle(await userStore.register(name, password, name), name);
    },
    signInWithRunes() {
      return Promise.reject(new AuthNotAvailableError());
    },
    signInWithPasskey() {
      return Promise.reject(new AuthNotAvailableError());
    },
  };
}
