<template>
  <div class="will-meter">
    <div class="will-row">
      <span class="will-emblem"
        ><img src="/board-assets/will-icon-image.png" alt="" aria-hidden="true"
      /></span>
      <p data-testid="knowledge-will" :aria-label="t('knowledge.will', { current, capacity })">
        {{ t('knowledge.willLabel') }} <b>{{ current }}</b
        >/{{ capacity }}
      </p>
    </div>
    <div
      class="will-bar"
      role="progressbar"
      :aria-valuenow="current"
      aria-valuemin="0"
      :aria-valuemax="capacity"
      :aria-label="t('knowledge.will', { current, capacity })"
    >
      <div class="will-bar__track">
        <div class="will-bar__fill" :style="{ width: `${percent}%` }"></div>
      </div>
      <span
        v-for="tick in ticks"
        :key="tick.value"
        class="will-bar__tick"
        :style="{ left: `${tick.percent}%` }"
        ><i></i>{{ tick.value }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ current: number; capacity: number }>();
const { t } = useI18n();
const percent = computed(() => Math.min(100, (props.current / props.capacity) * 100));
const ticks = computed(() =>
  [0.2, 0.5, 0.8, 1].map((share) => {
    const value = Math.round(props.capacity * share);
    return { value, percent: (value / props.capacity) * 100 };
  }),
);
</script>

<style scoped>
.will-meter {
  --copper: #c98a41;
  --copper-dim: #7b4a1e;
  --ember: #f5a524;
  display: grid;
  gap: 14px;
  color: #f1e4cc;
}
p {
  margin: 0;
}
.will-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.15rem;
}
.will-row b {
  color: var(--ember);
  font-weight: 700;
}
.will-emblem {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  clip-path: polygon(25% 3%, 75% 3%, 98% 50%, 75% 97%, 25% 97%, 2% 50%);
  background: linear-gradient(180deg, #d89a4a, #7b4a1e);
}
.will-emblem img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  clip-path: polygon(25% 3%, 75% 3%, 98% 50%, 75% 97%, 25% 97%, 2% 50%);
}
.will-bar {
  position: relative;
  padding-bottom: 24px;
}
.will-bar__track {
  height: 22px;
  padding: 3px;
  border: 1px solid var(--copper-dim);
  border-radius: 6px;
  background: #0b0908;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.8);
}
.will-bar__fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(180deg, #ffbf4a, #e0820d 60%, #b9610a);
  box-shadow: 0 0 10px rgba(245, 165, 36, 0.45);
  transition: width 0.35s ease;
}
.will-bar__tick {
  position: absolute;
  top: 24px;
  transform: translateX(-50%);
  font-size: 0.8rem;
  color: rgba(241, 228, 204, 0.75);
  white-space: nowrap;
}
.will-bar__tick i {
  position: absolute;
  left: 50%;
  top: -14px;
  width: 7px;
  height: 7px;
  border: 1px solid var(--copper);
  background: #261c12;
  transform: translateX(-50%) rotate(45deg);
}
</style>
