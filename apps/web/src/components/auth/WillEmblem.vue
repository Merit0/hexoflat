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
          fill="#141415"
          stroke="#ececee"
          :stroke-width="widths.outer"
          stroke-linejoin="round"
        />
        <polygon
          points="82,55 118,55 136,85 118,115 82,115 64,85"
          fill="#141415"
          stroke="#ececee"
          :stroke-width="widths.head"
          stroke-linejoin="round"
        />
        <g class="emblem__eyes" :style="{ transform: `translate(${eyeX}px, ${eyeY}px)` }">
          <g class="emblem__eye" :style="{ transform: `translate(${look.leftDx}px, 0)` }">
            <g
              class="emblem__scale"
              :style="{ transform: `scale(${look.leftScale})`, transformOrigin: '88px 85px' }"
            >
              <g class="emblem__lids" :style="{ opacity: leftClosed ? 0 : 1 }">
                <polygon
                  points="79,85 83.5,77.2 92.5,77.2 97,85 92.5,92.8 83.5,92.8"
                  fill="none"
                  stroke="#ececee"
                  :stroke-width="widths.eye"
                />
              </g>
              <g class="emblem__lids" :style="{ opacity: leftClosed ? 1 : 0 }">
                <path
                  d="M80 86 Q88 91 96 86"
                  fill="none"
                  stroke="#ececee"
                  :stroke-width="widths.eye"
                  stroke-linecap="round"
                />
              </g>
            </g>
          </g>
          <g class="emblem__eye" :style="{ transform: `translate(${look.rightDx}px, 0)` }">
            <g
              class="emblem__scale"
              :style="{ transform: `scale(${look.rightScale})`, transformOrigin: '112px 85px' }"
            >
              <g class="emblem__lids" :style="{ opacity: rightClosed ? 0 : 1 }">
                <polygon
                  points="103,85 107.5,77.2 116.5,77.2 121,85 116.5,92.8 107.5,92.8"
                  fill="none"
                  stroke="#ececee"
                  :stroke-width="widths.eye"
                />
              </g>
              <g class="emblem__lids" :style="{ opacity: rightClosed ? 1 : 0 }">
                <path
                  d="M104 86 Q112 91 120 86"
                  fill="none"
                  stroke="#ececee"
                  :stroke-width="widths.eye"
                  stroke-linecap="round"
                />
              </g>
            </g>
          </g>
        </g>
        <polyline
          points="44,176 70,124 130,124 156,176"
          fill="none"
          stroke="#ececee"
          :stroke-width="widths.body"
          stroke-linejoin="round"
        />
        <g transform="translate(0 6)">
          <path
            class="pow-heart"
            :style="{ animationDuration: `${heartSeconds}s` }"
            d="M100 164 L85 150 A9 9 0 0 1 100 138 A9 9 0 0 1 115 150 Z"
            fill="#E5484D"
          />
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { eyeLookFor, type EyeLook } from '@/features/auth/logic/emblem-mood';

const props = withDefaults(
  defineProps<{
    eyeX: number;
    eyeY: number;
    eyesClosed: boolean;
    heartSeconds: number;
    shakeKey: number;
    size?: 'lg' | 'sm';
    look?: EyeLook;
  }>(),
  { size: 'lg', look: () => eyeLookFor('none') },
);

const { t } = useI18n();
const root = ref<HTMLElement | null>(null);
const leftClosed = computed(() => props.eyesClosed || props.look.leftClosed);
const rightClosed = computed(() => props.eyesClosed || props.look.rightClosed);

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
  width: 182px;
}
.emblem--sm {
  width: 84px;
}
.emblem__svg {
  display: block;
  filter: drop-shadow(0 0 14px rgba(200, 208, 216, 0.45));
}
.emblem--lg .emblem__svg {
  width: 182px;
  height: 200px;
}
.emblem--sm .emblem__svg {
  width: 84px;
  height: 92px;
}
.emblem__eyes {
  transition: transform 0.14s ease-out;
}
.emblem__eye {
  transition: transform 0.3s cubic-bezier(0.3, 1.4, 0.5, 1);
}
.emblem__scale {
  transition: transform 0.35s cubic-bezier(0.3, 1.6, 0.5, 1);
}
@media (prefers-reduced-motion: reduce) {
  .emblem__eye,
  .emblem__scale {
    transition: none;
  }
}
.emblem__lids {
  transition: opacity 0.08s;
}
</style>
