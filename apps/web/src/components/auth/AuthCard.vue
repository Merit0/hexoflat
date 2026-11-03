<template>
  <div class="card" :class="`card--${variant}`" data-auth-card data-testid="auth-card">
    <SuccessPanel v-if="form.showSuccess" :name="form.successName" />
    <div v-else class="card__content">
      <AuthModeTabs :modes="form.modes" :current="form.mode" @select="form.setMode" />
      <SignInForm v-if="form.mode === 'signin'" :key="'signin'" />
      <HeroCodeForm v-else-if="form.mode === 'code'" :key="'code'" />
      <SignUpForm v-else :key="'new'" />
      <AuthFooter />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthForm } from '@/features/auth/composables/use-auth-form';
import AuthFooter from './AuthFooter.vue';
import AuthModeTabs from './AuthModeTabs.vue';
import HeroCodeForm from './HeroCodeForm.vue';
import SignInForm from './SignInForm.vue';
import SignUpForm from './SignUpForm.vue';
import SuccessPanel from './SuccessPanel.vue';

defineProps<{ variant: 'wide' | 'phone' }>();

const form = useAuthForm();
</script>

<style scoped>
.card {
  box-sizing: border-box;
  border: 1px solid var(--pow-border);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.card__content {
  display: flex;
  flex-direction: column;
  gap: inherit;
}
.card--wide {
  width: 100%;
  max-width: 440px;
  padding: 32px;
  border-radius: var(--pow-radius-card);
  background: var(--pow-surface);
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.card--phone {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 20px 28px;
  border-radius: 28px 28px 0 0;
  border-width: 1px 0 0;
  background: rgba(19, 24, 32, 0.92);
  box-shadow: 0 -16px 40px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 22px;
}
</style>
