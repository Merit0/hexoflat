<template>
  <section class="login game-root" data-testid="login-page">
    <AuthLayoutPhone v-if="breakpoint === 'phone'" />
    <AuthLayoutWide v-else />
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@/styles/auth-tokens.css';
import '@/styles/auth-motion.css';
import { provideAuthForm } from '@/features/auth/composables/use-auth-form';
import { useBreakpoint } from '@/features/auth/composables/use-breakpoint';
import AuthLayoutPhone from '@/components/auth/AuthLayoutPhone.vue';
import AuthLayoutWide from '@/components/auth/AuthLayoutWide.vue';

const breakpoint = useBreakpoint();
const form = provideAuthForm();

onMounted(() => {
  void form.startFresh();
  document.title = 'Path of Will';
});
</script>

<style scoped>
.login {
  background: var(--pow-bg);
}
</style>

<style>
.login button:not(.primary),
.login button:not(.primary):hover {
  box-shadow: none;
}
</style>
