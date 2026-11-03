<template>
  <form
    class="signup pow-rise"
    novalidate
    data-testid="auth-signup-form"
    @submit.prevent="form.submitSignUp"
  >
    <div class="signup__head">
      <h1 class="signup__title">{{ t('auth.new.title') }}</h1>
      <p class="signup__subtitle">{{ t('auth.new.subtitle') }}</p>
    </div>

    <HeroTokenPreview
      v-if="form.flags.guardianSignup"
      :name="form.newName"
      :grade="form.grade"
      :color="form.tokenColor"
      :steps="form.steps"
    />

    <AuthField
      id="auth-new-name"
      v-model="form.newName"
      :label="t('auth.field.name')"
      testid="auth-new-name"
      autocomplete="username"
      :maxlength="20"
      :placeholder="t('auth.new.namePlaceholder')"
      :helper="t('auth.new.nameHelp')"
      @focus="form.focus = 'newName'"
      @blur="form.focus = ''"
    />

    <AuthField
      id="auth-new-password"
      v-model="form.newPass"
      :label="t('auth.field.password')"
      testid="auth-new-password"
      type="password"
      autocomplete="new-password"
      :placeholder="t('auth.new.passwordPlaceholder')"
      @focus="form.focus = 'newPassword'"
      @blur="form.focus = ''"
    >
      <template #below>
        <PasswordStrength :score="form.score" :empty="form.newPass.length === 0" />
      </template>
    </AuthField>

    <template v-if="form.flags.guardianSignup">
      <GradePicker v-model="form.grade" />
      <AuthField
        id="auth-guardian-email"
        v-model="form.guardianEmail"
        :label="t('auth.new.guardian')"
        testid="auth-guardian-email"
        type="email"
        autocomplete="email"
        :placeholder="t('auth.new.guardianPlaceholder')"
        :helper="t('auth.new.guardianHelp')"
        @focus="form.focus = ''"
      />
    </template>

    <AuthAlert v-if="form.error" :message="form.error" />

    <PrimaryButton
      testid="auth-new-submit"
      idle-shadow="none"
      :loading="form.loading"
      :loading-text="t('auth.new.loading')"
      :ready="form.forgeCount === 4"
    >
      {{ t('auth.new.submit') }}
    </PrimaryButton>
  </form>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useAuthForm } from '@/features/auth/composables/use-auth-form';
import AuthAlert from './AuthAlert.vue';
import AuthField from './AuthField.vue';
import GradePicker from './GradePicker.vue';
import HeroTokenPreview from './HeroTokenPreview.vue';
import PasswordStrength from './PasswordStrength.vue';
import PrimaryButton from './PrimaryButton.vue';

const form = useAuthForm();
const { t } = useI18n();
</script>

<style scoped>
.signup {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.signup__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.signup__title {
  margin: 0;
  font-family: Cinzel, serif;
  font-size: 34px;
  font-weight: 600;
  color: var(--pow-text-strong);
}
.signup__subtitle {
  margin: 0;
  font-size: 17px;
  line-height: 1.45;
  color: var(--pow-text-muted);
}
@media (max-width: 599.98px) {
  .signup__title {
    font-size: 28px;
  }
}
</style>
