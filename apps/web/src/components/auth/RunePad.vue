<template>
  <div class="pad">
    <svg class="pad__trail" aria-hidden="true" viewBox="0 0 188 171">
      <polyline
        :points="runePolyline(picked)"
        fill="none"
        stroke="#8ba2b8"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray="2 7"
        opacity="0.8"
      />
    </svg>
    <button
      v-for="id in RUNE_IDS"
      :key="id"
      class="pad__rune"
      type="button"
      :data-testid="`auth-rune-${id}`"
      :aria-label="runeLabel(id)"
      :style="{
        left: `${(RUNE_POSITIONS[id][0] / PAD_WIDTH) * 100}%`,
        top: `${(RUNE_POSITIONS[id][1] / PAD_HEIGHT) * 100}%`,
      }"
      @click="emit('pick', id)"
    >
      <svg class="pad__svg" aria-hidden="true" viewBox="0 0 68 72">
        <polygon
          class="pad__hex"
          points="34,3 64,19.5 64,52.5 34,69 4,52.5 4,19.5"
          :fill="isPicked(id) ? '#2b3036' : '#18181a'"
          :stroke="isPicked(id) ? '#8ba2b8' : '#46464b'"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <g transform="translate(22 24)">
          <path
            :d="RUNE_PATHS[id]"
            fill="none"
            :stroke="isPicked(id) ? '#f4f4f5' : '#b8b8bf'"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>
      </svg>
      <span v-if="isPicked(id)" class="pad__badge" data-testid="auth-rune-order">{{
        picked.indexOf(id) + 1
      }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  PAD_HEIGHT,
  PAD_WIDTH,
  RUNE_IDS,
  RUNE_PATHS,
  RUNE_POSITIONS,
  runePolyline,
  type RuneId,
} from '@/features/auth/logic/runes';

const props = defineProps<{ picked: readonly RuneId[] }>();
const emit = defineEmits<{ pick: [id: RuneId] }>();

const { t } = useI18n();

const isPicked = (id: RuneId) => props.picked.includes(id);

const runeName = (id: RuneId): string => {
  const names: Record<RuneId, string> = {
    star: t('auth.rune.star'),
    moon: t('auth.rune.moon'),
    leaf: t('auth.rune.leaf'),
    flame: t('auth.rune.flame'),
    drop: t('auth.rune.drop'),
    bolt: t('auth.rune.bolt'),
    sun: t('auth.rune.sun'),
  };
  return names[id];
};

const runeLabel = (id: RuneId): string => {
  const name = runeName(id);
  const index = props.picked.indexOf(id);
  return index >= 0
    ? t('auth.code.runeChosen', { name, n: index + 1 })
    : t('auth.code.rune', { name });
};
</script>

<style scoped>
.pad {
  position: relative;
  width: 100%;
  aspect-ratio: 188 / 171;
}
.pad__trail {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.pad__rune {
  position: absolute;
  z-index: 0;
  width: 36.17%;
  height: 42.11%;
  container-type: inline-size;
  padding: 0;
  border: 0;
  border-radius: 16px;
  background: transparent;
}
.pad__rune:hover,
.pad__rune:focus-visible {
  z-index: 1;
}
.pad__rune:hover,
.pad__rune:active {
  background: transparent;
  box-shadow: none;
  border-color: transparent;
}
.pad__rune:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
.pad__svg {
  width: 100%;
  height: 100%;
  display: block;
  transition: transform 0.1s;
}
.pad__hex {
  transition:
    fill 0.15s,
    stroke 0.15s;
}
.pad__rune:hover .pad__hex {
  stroke: var(--pow-link);
}
.pad__rune:active .pad__svg {
  transform: scale(0.94);
}
.pad__badge {
  position: absolute;
  left: 73.5%;
  top: 33.3%;
  width: 26cqw;
  height: 26cqw;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: var(--pow-text-strong);
  color: var(--pow-accent-ink);
  font-family: Inter, sans-serif;
  font-weight: 700;
  font-size: 16cqw;
  line-height: 26cqw;
  text-align: center;
  pointer-events: none;
}
</style>
