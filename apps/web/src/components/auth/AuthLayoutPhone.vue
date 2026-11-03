<template>
  <div ref="root" class="phone" data-testid="auth-layout-phone">
    <AuthBackground variant="phone" :mx="mx" :my="my" :ripples="ripples" />
    <header class="phone__header">
      <WillEmblem
        ref="emblem"
        :eye-x="mood.eyeX"
        :eye-y="mood.eyeY"
        :eyes-closed="mood.eyesClosed"
        :heart-seconds="mood.heartSeconds"
        :shake-key="form.shakeKey"
        size="sm"
      />
      <p class="phone__wordmark">Path of Will</p>
      <TaglineCarousel variant="phone" />
    </header>
    <AuthCard variant="phone" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthForm } from '@/features/auth/composables/use-auth-form';
import { useAuthStage } from '@/features/auth/composables/use-auth-stage';
import AuthBackground from './AuthBackground.vue';
import AuthCard from './AuthCard.vue';
import TaglineCarousel from './TaglineCarousel.vue';
import WillEmblem from './WillEmblem.vue';

const form = useAuthForm();
const root = ref<HTMLElement | null>(null);
const emblem = ref<InstanceType<typeof WillEmblem> | null>(null);

const { mx, my, ripples, mood } = useAuthStage(root, () => emblem.value?.el ?? null);
</script>

<style scoped>
.phone {
  height: 100vh;
  height: 100dvh;
  position: relative;
  overflow: hidden;
  background: var(--pow-bg);
  color: var(--pow-text);
  font-family: Inter, system-ui, sans-serif;
  display: flex;
  flex-direction: column;
}
.phone__header {
  position: relative;
  box-sizing: border-box;
  padding: 36px 24px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
}
.phone__wordmark {
  margin: 0;
  font-family: Cinzel, serif;
  font-weight: 700;
  font-size: 30px;
  letter-spacing: 0.08em;
  line-height: 1;
  color: var(--pow-text-strong);
}
.phone :deep(.card--phone) {
  position: relative;
}
</style>
