<template>
  <section class="brand">
    <WillEmblem
      ref="emblem"
      :eye-x="mood.eyeX"
      :eye-y="mood.eyeY"
      :eyes-closed="mood.eyesClosed"
      :heart-seconds="mood.heartSeconds"
      :shake-key="shakeKey"
      size="lg"
    />
    <div class="brand__text">
      <p class="brand__wordmark">Path of Will</p>
      <TaglineCarousel variant="wide" />
    </div>
    <ul class="brand__features" data-testid="auth-features">
      <li class="brand__feature">
        <svg
          class="brand__icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7FB8E6"
          stroke-width="1.6"
          stroke-linejoin="round"
        >
          <path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" />
          <path d="M12 7l4.3 2.5v5L12 17l-4.3-2.5v-5z" />
        </svg>
        {{ t('auth.feature.map') }}
      </li>
      <li class="brand__feature">
        <svg
          class="brand__icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7FB8E6"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
        </svg>
        {{ t('auth.feature.riddles') }}
      </li>
      <li class="brand__feature">
        <svg
          class="brand__icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7FB8E6"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="9" cy="8" r="3.5" />
          <circle cx="17" cy="9.5" r="2.8" />
          <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M15.5 14.6c2.6-.3 5 1.3 5.8 4.4" />
        </svg>
        {{ t('auth.feature.friends') }}
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { EmblemMood } from '@/features/auth/logic/emblem-mood';
import TaglineCarousel from './TaglineCarousel.vue';
import WillEmblem from './WillEmblem.vue';

defineProps<{ mood: EmblemMood; shakeKey: number }>();

const { t } = useI18n();
const emblem = ref<InstanceType<typeof WillEmblem> | null>(null);

defineExpose({ emblemEl: computed(() => emblem.value?.el ?? null) });
</script>

<style scoped>
.brand {
  position: relative;
  flex: 1 1 520px;
  min-width: 0;
  box-sizing: border-box;
  padding: 64px clamp(24px, 6vw, 96px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
}
.brand__text {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.brand__wordmark {
  margin: 0;
  font-family: Cinzel, serif;
  font-weight: 700;
  font-size: clamp(40px, 5vw, 64px);
  letter-spacing: 0.08em;
  line-height: 1;
  color: var(--pow-text-strong);
}
.brand__features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 460px;
}
.brand__feature {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 15px;
  color: var(--pow-text-2);
}
.brand__icon {
  width: 22px;
  height: 22px;
  flex: none;
}
</style>
