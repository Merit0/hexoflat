<template>
  <div class="will-meter">
    <div class="will-strip">
      <div class="will-left">
        <img class="will-icon" src="/board-assets/will-icon-image.png" alt="" aria-hidden="true" />
        <p
          class="will-figures"
          data-testid="knowledge-will"
          :aria-label="t('knowledge.will', { current, capacity })"
        >
          <span class="will-figures__label">{{ t('knowledge.willName') }}</span>
          <span class="will-figures__value" data-testid="knowledge-will-value">
            <span class="will-current" :class="{ 'is-gain': gained }">{{ current }}</span>
            / {{ capacity }}
          </span>
        </p>
      </div>
      <i class="will-divider" aria-hidden="true"></i>
      <p class="will-hint">{{ t('knowledge.meterHint') }}</p>
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
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ current: number; capacity: number }>();
const { t } = useI18n();
const gained = ref(false);
let gainTimer: number | null = null;
watch(
  () => props.current,
  (next, previous) => {
    if (next <= previous) return;
    gained.value = true;
    if (gainTimer) window.clearTimeout(gainTimer);
    gainTimer = window.setTimeout(() => (gained.value = false), 700);
  },
);
onBeforeUnmount(() => {
  if (gainTimer) window.clearTimeout(gainTimer);
});
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
  --copper: #7a8da0;
  --copper-dim: #3a4a58;
  --ember: #f5a524;
  display: grid;
  gap: 14px;
  color: #f1e4cc;
}
p {
  margin: 0;
}
.will-strip {
  --diamond: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M5 0L10 5L5 10L0 5Z' fill='%23b8864a'/></svg>");
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 11px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  height: 68px;
  padding: 4px 12px;
  background: linear-gradient(180deg, #5a6d7e, #202b36);
  clip-path: polygon(
    12px 0,
    calc(100% - 12px) 0,
    100% 12px,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    12px 100%,
    0 calc(100% - 12px),
    0 12px
  );
}
.will-strip::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: -1;
  background: linear-gradient(180deg, #1a2029, #10151c);
  clip-path: polygon(
    10px 0,
    calc(100% - 10px) 0,
    100% 10px,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    10px 100%,
    0 calc(100% - 10px),
    0 10px
  );
}
.will-left {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  gap: 8px;
}
.will-figures {
  display: grid;
  gap: 2px;
  white-space: nowrap;
}
.will-figures__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #f3e8d2;
}
.will-figures__value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #f3e8d2;
}
.will-current {
  transition:
    color 0.35s ease,
    text-shadow 0.35s ease;
}
.will-current.is-gain {
  color: #6dff9c;
  text-shadow: 0 0 8px rgba(109, 255, 156, 0.55);
  transition-duration: 0.08s;
}
.will-divider {
  align-self: stretch;
  background:
    var(--diamond) center / 11px 11px no-repeat,
    linear-gradient(180deg, transparent, #b8864a 20%, #b8864a 80%, transparent) center / 1px 100%
      no-repeat;
}
.will-hint {
  white-space: pre-line;
  text-align: center;
  font-size: 0.8rem;
  line-height: 1.15;
  font-weight: 600;
  text-wrap: balance;
  color: rgba(243, 232, 210, 0.82);
}
.will-icon {
  width: 60px;
  height: 60px;
  flex: 0 0 auto;
  object-fit: contain;
  filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.6));
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
  top: 26px;
  transform: translateX(-50%);
  font-size: 1rem;
  font-weight: 700;
  color: #f3e8d2;
  white-space: nowrap;
}
.will-bar__tick i {
  position: absolute;
  left: 50%;
  top: -16px;
  box-sizing: border-box;
  width: 11px;
  height: 11px;
  border: 2px solid #c3cfda;
  background: #10151c;
  transform: translateX(-50%) rotate(45deg);
}
</style>
