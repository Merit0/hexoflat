<template>
  <div ref="root" class="emblem" :class="[`emblem--${size}`, shakeClass]" data-testid="auth-emblem">
    <div class="pow-float" data-testid="auth-emblem-float">
      <svg
        class="emblem__svg"
        data-emblem="1"
        role="img"
        :aria-label="t('auth.emblem')"
        viewBox="0 0 200 220"
      >
        <polygon
          points="100,8 188,58 188,162 100,212 12,162 12,58"
          fill="#121820"
          stroke="#E9F2FB"
          :stroke-width="widths.outer"
          stroke-linejoin="round"
        />
        <polygon
          points="82,55 118,55 136,85 118,115 82,115 64,85"
          fill="#121820"
          stroke="#E9F2FB"
          :stroke-width="widths.head"
          stroke-linejoin="round"
        />
        <g class="emblem__eyes" :style="{ transform: `translate(${eyeX}px, ${eyeY}px)` }">
          <g class="emblem__lids" :style="{ opacity: eyesClosed ? 0 : 1 }">
            <polygon
              points="79,85 83.5,77.2 92.5,77.2 97,85 92.5,92.8 83.5,92.8"
              fill="none"
              stroke="#E9F2FB"
              :stroke-width="widths.eye"
            />
            <polygon
              points="103,85 107.5,77.2 116.5,77.2 121,85 116.5,92.8 107.5,92.8"
              fill="none"
              stroke="#E9F2FB"
              :stroke-width="widths.eye"
            />
          </g>
          <g class="emblem__lids" :style="{ opacity: eyesClosed ? 1 : 0 }">
            <path
              d="M80 86 Q88 91 96 86 M104 86 Q112 91 120 86"
              fill="none"
              stroke="#E9F2FB"
              :stroke-width="widths.eye"
              stroke-linecap="round"
            />
          </g>
        </g>
        <polyline
          points="44,176 70,124 130,124 156,176"
          fill="none"
          stroke="#E9F2FB"
          :stroke-width="widths.body"
          stroke-linejoin="round"
        />
        <path
          class="pow-heart"
          :style="{ animationDuration: `${heartSeconds}s` }"
          d="M100 164 L85 150 A9 9 0 0 1 100 138 A9 9 0 0 1 115 150 Z"
          fill="#E5484D"
        />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    eyeX: number;
    eyeY: number;
    eyesClosed: boolean;
    heartSeconds: number;
    shakeKey: number;
    size?: 'lg' | 'sm';
  }>(),
  { size: 'lg' },
);

const { t } = useI18n();
const root = ref<HTMLElement | null>(null);

const shakeClass = computed(() => {
  if (props.shakeKey === 0) return '';
  return props.shakeKey % 2 ? 'pow-shake-a' : 'pow-shake-b';
});

const widths = computed(() =>
  props.size === 'sm'
    ? { outer: 6, head: 5, eye: 4, body: 5 }
    : { outer: 5, head: 4, eye: 3, body: 4 },
);

defineExpose({ el: root });
</script>

<style scoped>
.emblem--lg {
  width: 152px;
}
.emblem--sm {
  width: 84px;
}
.emblem__svg {
  display: block;
  filter: drop-shadow(0 0 14px rgba(190, 220, 255, 0.45));
}
.emblem--lg .emblem__svg {
  width: 152px;
  height: 167px;
}
.emblem--sm .emblem__svg {
  width: 84px;
  height: 92px;
}
.emblem__eyes {
  transition: transform 0.14s ease-out;
}
.emblem__lids {
  transition: opacity 0.08s;
}
</style>
