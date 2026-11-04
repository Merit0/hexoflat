<template>
  <form
    class="signin pow-rise"
    novalidate
    data-testid="auth-signin-form"
    @submit.prevent="form.submitSignIn"
  >
    <div class="signin__head">
      <h1 class="signin__title">{{ t('auth.signin.title') }}</h1>
      <p class="signin__subtitle">{{ t('auth.signin.subtitle') }}</p>
    </div>

    <div v-if="form.recentHeroes.length" class="signin__recent">
      <div class="signin__chips">
        <RecentHeroChip
          v-for="hero in form.recentHeroes"
          :key="hero.name"
          :hero="hero"
          :selected="form.user === hero.name"
          @pick="form.choosePickedHero(hero.name)"
        />
      </div>
    </div>

    <AuthField
      id="auth-name"
      ref="nameField"
      v-model="form.user"
      :label="t('auth.field.name')"
      testid="auth-name"
      autocomplete="username"
      :placeholder="t('auth.field.namePlaceholder')"
      @focus="form.focus = 'name'"
      @blur="form.focus = ''"
    />

    <PasswordField
      id="auth-password"
      v-model="form.pass"
      v-model:show="form.show"
      :label="t('auth.field.password')"
      testid="auth-password"
      autocomplete="current-password"
      :placeholder="t('auth.field.passwordPlaceholder')"
      :forgot-link="form.flags.placeholderLinks"
      :caps="form.caps"
      @focus="form.focus = 'password'"
      @blur="form.focus = ''"
      @keyup="onKey"
    />

    <RememberSwitch v-model="form.remember" />

    <AuthAlert v-if="form.error" :message="form.error" />

    <PrimaryButton
      testid="auth-submit"
      :loading="form.loading"
      :loading-text="t('auth.signin.loading')"
      :ready="!!form.user && !!form.pass"
    >
      {{ t('auth.signin.submit') }}
    </PrimaryButton>

    <template v-if="form.flags.passkey">
      <div class="signin__or">
        <span class="signin__line" />{{ t('auth.or') }}<span class="signin__line" />
      </div>
      <button
        class="signin__passkey"
        type="button"
        data-testid="auth-passkey"
        :disabled="form.loading"
        @click="form.submitPasskey"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8ba2b8"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="8" cy="12" r="4" />
          <path d="M12 12h9M18 12v3M21 12v2" />
        </svg>
        {{ t('auth.passkey') }}
      </button>
    </template>
  </form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthForm } from '@/features/auth/composables/use-auth-form';
import { useBreakpoint } from '@/features/auth/composables/use-breakpoint';
import AuthAlert from './AuthAlert.vue';
import AuthField from './AuthField.vue';
import PasswordField from './PasswordField.vue';
import PrimaryButton from './PrimaryButton.vue';
import RecentHeroChip from './RecentHeroChip.vue';
import RememberSwitch from './RememberSwitch.vue';

const form = useAuthForm();
const { t } = useI18n();
const breakpoint = useBreakpoint();
const nameField = ref<InstanceType<typeof AuthField> | null>(null);

const onKey = (event: KeyboardEvent) => {
  form.caps = event.getModifierState?.('CapsLock') ?? false;
};

onMounted(() => {
  if (breakpoint.value === 'wide' && !form.user) nameField.value?.focus();
});
</script>

<style scoped>
.signin {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.signin__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.signin__title {
  margin: 0;
  font-family: Cinzel, serif;
  font-size: 34px;
  font-weight: 600;
  color: var(--pow-text-strong);
}
.signin__subtitle {
  margin: 0;
  font-size: 17px;
  line-height: 1.45;
  color: var(--pow-text-muted);
}
.signin__recent {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.signin__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.signin__or {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #707077;
  font-size: 14px;
}
.signin__line {
  flex: 1;
  height: 1px;
  background: #2b2b2e;
}
.signin__passkey {
  height: 54px;
  border-radius: var(--pow-radius-btn);
  border: 1px solid var(--pow-border-field);
  background: var(--pow-chip);
  color: var(--pow-text);
  font:
    600 17px Inter,
    sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition:
    filter 0.15s,
    transform 0.1s;
}
.signin__passkey svg {
  width: 20px;
  height: 20px;
}
.signin__passkey:hover {
  filter: brightness(1.1);
}
.signin__passkey:active {
  transform: translateY(1px);
}
.signin__passkey:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
@media (max-width: 599.98px) {
  .signin__title {
    font-size: 28px;
  }
}
</style>
