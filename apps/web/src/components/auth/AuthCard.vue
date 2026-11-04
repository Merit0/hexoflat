<template>
  <div class="card" :class="`card--${variant}`" data-auth-card data-testid="auth-card">
    <SuccessPanel v-if="form.showSuccess" :name="form.successName" />
    <div v-else class="card__content">
      <AuthModeTabs :modes="form.modes" :current="form.mode" @select="form.setMode" />
      <div class="card__body">
        <SignInForm v-if="form.mode === 'signin'" :key="'signin'" />
        <HeroCodeForm v-else-if="form.mode === 'code'" :key="'code'" />
        <SignUpForm v-else :key="'new'" />
      </div>
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
  flex: 1;
  min-height: 0;
}
.card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 32px;
}
.card--wide .card__body > * {
  width: 100%;
}
.card--wide {
  width: 100%;
  min-height: 100vh;
  --pad-x: 44px;
  padding: 0 var(--pad-x) 20px;
  border-radius: 0;
  border-width: 0 0 0 1px;
  background: var(--pow-surface);
  box-shadow: -24px 0 60px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.card--phone {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  --pad-x: 20px;
  padding: 0 var(--pad-x) 28px;
  border-radius: 0;
  border-width: 1px 0 0;
  background: rgba(22, 22, 23, 0.92);
  box-shadow: 0 -16px 40px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 22px;
}
</style>
