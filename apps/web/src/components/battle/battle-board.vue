<template>
  <div
    ref="pane"
    class="battle-board"
    data-testid="battle-board"
    :data-ready="ready"
    :data-animating="animating"
    @pointerleave="emit('hex-hover', null)"
  >
    <canvas ref="canvas" class="battle-board__canvas" />
    <battle-banner v-if="banner" class="battle-board__banner" v-bind="banner" />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleHex } from '@hexoflat/engine/battle/battle-state';
import BattleBanner from '@/components/battle/battle-banner.vue';
import type { BattleBannerProps } from '@/render/battle/battle-banner';
import { useBattleBoard, type BattleBoardScene } from '@/render/battle/use-battle-board';
import type { BattleOverlayModel } from '@/render/battle/battle-overlay-model';
import type { BattleMovePreview } from '@/composables/battle-board-tap';
import type { BoardFrame } from '@/render/board-camera';

const props = defineProps<{
  scene: BattleBoardScene;
  overlay: BattleOverlayModel;
  preview?: BattleMovePreview | null;
  referenceFrame?: BoardFrame | null;
  banner?: BattleBannerProps | null;
  takeEvents?: () => DomainEvent[];
}>();

const emit = defineEmits<{
  'hex-tap': [hex: BattleHex];
  'hex-hover': [hex: BattleHex | null];
  animating: [busy: boolean];
}>();

const pane = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const ready = ref(false);
const animating = ref(false);

useBattleBoard({
  pane,
  canvas,
  scene: computed(() => props.scene),
  overlay: computed(() => props.overlay),
  preview: computed(() => props.preview ?? null),
  referenceFrame: computed(() => props.referenceFrame ?? null),
  onReady: () => {
    ready.value = true;
  },
  onHexTap: (hex) => emit('hex-tap', hex),
  onHexHover: (hex) => emit('hex-hover', hex),
  takeEvents: () => props.takeEvents?.() ?? [],
  onAnimating: (busy) => {
    animating.value = busy;
    emit('animating', busy);
  },
});
</script>

<style scoped>
.battle-board {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0f0e12;
}

.battle-board__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.battle-board__banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
}
</style>
