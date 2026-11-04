import { computed, inject, provide, reactive, ref, watch, type InjectionKey } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ROUTES } from '@/router/routes';
import { useUiSettingsStore } from '@/stores/ui-settings-store';
import {
  AuthNotAvailableError,
  createAuthGateway,
  type AuthGateway,
  type AuthResult,
} from '@/services/auth-gateway';
import { parseAuthMode, readAuthFlags, visibleAuthModes, type AuthMode } from '../logic/auth-flags';
import type { AuthFocus } from '../logic/emblem-mood';
import { forgeDone, forgeSteps, isGuardianEmailValid } from '../logic/forge-progress';
import { DEFAULT_GRADE, GRADE_COLORS, heroColorFor, type Grade } from '../logic/grade-colors';
import { isPasswordStrongEnough, passwordScore } from '../logic/password-score';
import { pickRune, resetRunes, type RuneId } from '../logic/runes';
import { useRecentHeroes } from './use-recent-heroes';

const SUCCESS_PANEL_DELAY_MS = 300;

function createAuthForm(gateway: AuthGateway) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const route = useRoute();
  const uiSettings = useUiSettingsStore();
  const flags = readAuthFlags();
  const recent = useRecentHeroes();

  const mode = ref<AuthMode>(parseAuthMode(route.query.mode, flags));
  const user = ref('');
  const pass = ref('');
  const show = ref(false);
  const remember = ref(true);
  const caps = ref(false);
  const error = ref('');
  const shakeKey = ref(0);
  const loading = ref(false);
  const focus = ref<AuthFocus>('');
  const runes = ref<RuneId[]>([]);
  const runeHero = ref('');
  const newName = ref('');
  const newPass = ref('');
  const grade = ref<Grade>(DEFAULT_GRADE);
  const guardianEmail = ref('');
  const successName = ref('');
  const showSuccess = ref(false);

  const modes = computed(() => visibleAuthModes(flags));
  const score = computed(() => passwordScore(newPass.value));
  const steps = computed(() =>
    forgeSteps({
      name: newName.value,
      score: score.value,
      email: flags.guardianSignup ? guardianEmail.value : 'ok@ok.ok',
    }),
  );
  const forgeCount = computed(() => forgeDone(steps.value));
  const tokenColor = computed(() => GRADE_COLORS[grade.value]);

  const fail = (message: string) => {
    error.value = message;
    shakeKey.value += 1;
  };

  watch([user, pass, newName, newPass, guardianEmail], () => {
    error.value = '';
  });

  const setMode = (next: AuthMode) => {
    mode.value = next;
    error.value = '';
    runes.value = resetRunes();
    loading.value = false;
  };

  const failureMessage = (result: Extract<AuthResult, { ok: false }>): string => {
    if (result.kind === 'credentials') return t('auth.err.credentials');
    if (result.kind === 'taken') return t('auth.err.taken');
    if (result.kind === 'unavailable') return t('auth.err.notAvailable');
    return result.message;
  };

  const settle = async (result: AuthResult): Promise<boolean> => {
    if (!result.ok) {
      fail(failureMessage(result));
      return false;
    }
    recent.remember({ name: result.name, color: heroColorFor(result.name) });
    successName.value = result.name;
    const panelTimer = setTimeout(() => {
      showSuccess.value = true;
    }, SUCCESS_PANEL_DELAY_MS);
    try {
      await router.replace({ name: ROUTES.WORLD, params: { locationKey: 'camping' } });
    } finally {
      clearTimeout(panelTimer);
    }
    return true;
  };

  const run = async (action: () => Promise<AuthResult>): Promise<void> => {
    if (loading.value) return;
    loading.value = true;
    error.value = '';
    try {
      const done = await settle(await action());
      if (!done) loading.value = false;
    } catch (caught) {
      loading.value = false;
      if (caught instanceof AuthNotAvailableError) fail(t('auth.err.notAvailable'));
      else fail(t('auth.err.generic'));
    }
  };

  const submitSignIn = async () => {
    if (loading.value) return;
    const name = user.value.trim();
    if (!name) {
      fail(t('auth.err.name'));
      return;
    }
    if (!pass.value) {
      fail(t('auth.err.password'));
      return;
    }
    await run(() => gateway.signIn({ name, password: pass.value, remember: remember.value }));
  };

  const submitSignUp = async () => {
    if (loading.value) return;
    const name = newName.value.trim();
    if (!name) {
      fail(t('auth.err.newName'));
      return;
    }
    if (!isPasswordStrongEnough(newPass.value)) {
      fail(t('auth.err.weak'));
      return;
    }
    if (flags.guardianSignup && !isGuardianEmailValid(guardianEmail.value)) {
      fail(t('auth.err.guardian'));
      return;
    }
    await run(() =>
      gateway.signUp({
        name,
        password: newPass.value,
        ...(flags.guardianSignup ? { grade: grade.value, guardianEmail: guardianEmail.value } : {}),
      }),
    );
  };

  const submitPasskey = async () => {
    await run(() => gateway.signInWithPasskey({ name: user.value.trim() || undefined }));
  };

  const choosePickedHero = (name: string) => {
    if (mode.value === 'code') {
      runeHero.value = name;
      runes.value = resetRunes();
    } else {
      user.value = name;
    }
    error.value = '';
  };

  const pickRuneById = async (id: RuneId) => {
    if (loading.value) return;
    if (!runeHero.value) {
      fail(t('auth.err.pickHero'));
      return;
    }
    const picked = pickRune(runes.value, id);
    runes.value = picked.runes;
    error.value = '';
    if (!picked.complete) return;
    const code = picked.runes as [string, string, string, string];
    await run(() => gateway.signInWithRunes({ name: runeHero.value, runes: code }));
    if (error.value) runes.value = resetRunes();
  };

  const clearRunes = () => {
    runes.value = resetRunes();
    error.value = '';
  };

  const toggleLocale = () => {
    uiSettings.setLocale(locale.value === 'uk' ? 'en' : 'uk');
  };

  const selectedHeroName = computed(() => (mode.value === 'code' ? runeHero.value : user.value));

  return reactive({
    flags,
    mode,
    modes,
    user,
    pass,
    show,
    remember,
    caps,
    error,
    shakeKey,
    loading,
    focus,
    runes,
    runeHero,
    newName,
    newPass,
    grade,
    guardianEmail,
    successName,
    showSuccess,
    score,
    steps,
    forgeCount,
    tokenColor,
    recentHeroes: recent.heroes,
    selectedHeroName,
    setMode,
    submitSignIn,
    submitSignUp,
    submitPasskey,
    choosePickedHero,
    pickRuneById,
    clearRunes,
    toggleLocale,
    startFresh: () => gateway.startFresh(),
  });
}

export type AuthForm = ReturnType<typeof createAuthForm>;

const AUTH_FORM_KEY: InjectionKey<AuthForm> = Symbol('auth-form');

export function provideAuthForm(): AuthForm {
  const form = createAuthForm(createAuthGateway());
  provide(AUTH_FORM_KEY, form);
  return form;
}

export function useAuthForm(): AuthForm {
  const form = inject(AUTH_FORM_KEY);
  if (!form) throw new Error('useAuthForm() needs provideAuthForm() in an ancestor');
  return form;
}
