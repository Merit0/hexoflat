<template>
  <div ref="root" class="wide" data-testid="auth-layout-wide">
    <AuthBackground variant="wide" :mx="mx" :my="my" :ripples="ripples" />
    <AuthBrandPanel ref="brand" :mood="mood" :shake-key="form.shakeKey" />
    <section class="wide__auth">
      <AuthCard variant="wide" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthForm } from '@/features/auth/composables/use-auth-form';
import { useAuthStage } from '@/features/auth/composables/use-auth-stage';
import AuthBackground from './AuthBackground.vue';
import AuthBrandPanel from './AuthBrandPanel.vue';
import AuthCard from './AuthCard.vue';

const form = useAuthForm();
const root = ref<HTMLElement | null>(null);
const brand = ref<InstanceType<typeof AuthBrandPanel> | null>(null);

const { mx, my, ripples, mood } = useAuthStage(root, () => brand.value?.emblemEl ?? null);
</script>

<style scoped>
.wide {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background: var(--pow-bg);
  color: var(--pow-text);
  font-family: Inter, system-ui, sans-serif;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
}
.wide__auth {
  position: relative;
  flex: 1 1 480px;
  min-width: 0;
  box-sizing: border-box;
  padding: 48px 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
