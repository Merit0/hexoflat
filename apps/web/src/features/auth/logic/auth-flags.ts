export interface AuthFlags {
  heroCode: boolean;
  passkey: boolean;
  guardianSignup: boolean;
  placeholderLinks: boolean;
}

export type AuthMode = 'signin' | 'code' | 'new';

function on(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function readAuthFlags(env: ImportMetaEnv = import.meta.env): AuthFlags {
  const dev = env.DEV;
  return {
    heroCode: on(env.VITE_AUTH_HERO_CODE, dev),
    passkey: on(env.VITE_AUTH_PASSKEY, dev),
    guardianSignup: on(env.VITE_AUTH_GUARDIAN_SIGNUP, dev),
    placeholderLinks: on(env.VITE_AUTH_PLACEHOLDER_LINKS, dev),
  };
}

export function visibleAuthModes(flags: AuthFlags): AuthMode[] {
  return flags.heroCode ? ['signin', 'code', 'new'] : ['signin', 'new'];
}

export function parseAuthMode(value: unknown, flags: AuthFlags): AuthMode {
  const modes = visibleAuthModes(flags);
  return modes.find((mode) => mode === value) ?? 'signin';
}
