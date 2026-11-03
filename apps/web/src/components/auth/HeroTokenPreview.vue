<template>
  <div class="token">
    <svg
      class="token__hex"
      aria-hidden="true"
      viewBox="0 0 64 64"
      :style="{ filter: `drop-shadow(0 0 10px ${done === 4 ? color : 'rgba(0,0,0,0)'})` }"
    >
      <polygon
        class="token__outline"
        points="32,2 58,17 58,47 32,62 6,47 6,17"
        fill="#1A2330"
        :stroke="color"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
      <text
        x="32"
        y="41"
        text-anchor="middle"
        font-family="Cinzel, serif"
        font-size="24"
        font-weight="700"
        fill="#F2F6FA"
      >
        {{ initial }}
      </text>
    </svg>
    <div class="token__info">
      <p class="token__name" data-testid="auth-token-name">{{ shownName }}</p>
      <p class="token__grade">{{ t('auth.new.gradeShort', { n: grade }) }}</p>
      <div class="token__forge" role="img" :aria-label="t('auth.new.forge', { n: done })">
        <svg v-for="(ok, i) in steps" :key="i" class="token__cell" viewBox="0 0 14 16">
          <polygon
            class="token__cell-hex"
            points="7,1 13,4.5 13,11.5 7,15 1,11.5 1,4.5"
            :fill="ok ? color : 'transparent'"
            :stroke="ok ? color : '#3A4452'"
            stroke-width="1.2"
          />
        </svg>
        <span class="token__label" data-testid="auth-forge-label">{{
          done === 4 ? t('auth.new.ready') : `${done} / 4`
        }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  name: string;
  grade: number;
  color: string;
  steps: readonly boolean[];
}>();

const { t } = useI18n();

const trimmed = computed(() => props.name.trim());
const shownName = computed(() => trimmed.value || t('auth.new.yourHero'));
const initial = computed(() => (trimmed.value[0] ?? '?').toUpperCase());
const done = computed(() => props.steps.filter(Boolean).length);
</script>

<style scoped>
.token {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px;
  border-radius: 16px;
  background: var(--pow-field);
  border: 1px solid #222b37;
}
.token__hex {
  width: 64px;
  height: 64px;
  flex: none;
  transition: filter 0.3s;
}
.token__outline {
  transition: stroke 0.3s;
}
.token__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.token__name {
  margin: 0;
  font-family: Cinzel, serif;
  font-size: 20px;
  font-weight: 600;
  color: var(--pow-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.token__grade {
  margin: 0;
  font-size: 13px;
  color: var(--pow-text-muted);
}
.token__forge {
  display: flex;
  align-items: center;
  gap: 6px;
}
.token__cell {
  width: 14px;
  height: 16px;
}
.token__cell-hex {
  transition: fill 0.2s;
}
.token__label {
  font-size: 12px;
  color: var(--pow-text-muted);
  margin-left: 4px;
}
</style>
