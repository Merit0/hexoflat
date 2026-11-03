<template>
  <div class="tagline" :class="`tagline--${variant}`">
    <p
      class="tagline__text"
      :class="index % 2 ? 'pow-fade-b' : 'pow-fade-a'"
      aria-live="polite"
      data-testid="auth-tagline"
    >
      {{ tips[index] }}
    </p>
    <div v-if="variant === 'wide'" class="tagline__dots">
      <button
        v-for="(_, i) in tips"
        :key="i"
        class="tagline__dot"
        type="button"
        :data-testid="`auth-tagline-dot-${i}`"
        :aria-label="t('auth.tip', { n: i + 1 })"
        @click="goTo(i)"
      >
        <span
          class="tagline__pill"
          :style="{
            width: `${i === index ? 24 : 8}px`,
            background: i === index ? '#7FB8E6' : '#3A4452',
          }"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTagline } from '@/features/auth/composables/use-tagline';

defineProps<{ variant: 'wide' | 'phone' }>();

const { t } = useI18n();
const { index, goTo } = useTagline(3, 5000);

const tips = computed(() => [t('auth.tagline.1'), t('auth.tagline.2'), t('auth.tagline.3')]);
</script>

<style scoped>
.tagline__text {
  margin: 0;
  color: var(--pow-text-3);
}
.tagline--wide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tagline--wide .tagline__text {
  max-width: 460px;
  min-height: 56px;
  font-size: 18px;
  line-height: 1.55;
}
.tagline--phone .tagline__text {
  min-height: 22px;
  font-size: 14px;
  text-align: center;
}
.tagline__dots {
  display: flex;
  gap: 8px;
}
.tagline__dot {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tagline__dot:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
.tagline__pill {
  height: 6px;
  border-radius: 3px;
  display: block;
  transition:
    width 0.25s,
    background 0.25s;
}
</style>
