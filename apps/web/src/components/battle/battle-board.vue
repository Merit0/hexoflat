<template>
  <div ref="pane" class="battle-board" data-testid="battle-board" :data-ready="ready">
    <canvas ref="canvas" class="battle-board__canvas" />
    <battle-banner v-if="banner" class="battle-board__banner" v-bind="banner" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import BattleBanner from '@/components/battle/battle-banner.vue';
import type { BattleBannerProps } from '@/render/battle/battle-banner';
import { useBattleBoard, type BattleBoardScene } from '@/render/battle/use-battle-board';
import type { BattleOverlayModel } from '@/render/battle/battle-overlay-model';

const props = defineProps<{
  scene: BattleBoardScene;
  overlay: BattleOverlayModel;
  banner?: BattleBannerProps | null;
}>();

const pane = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const ready = ref(false);

useBattleBoard({
  pane,
  canvas,
  scene: computed(() => props.scene),
  overlay: computed(() => props.overlay),
  onReady: () => {
    ready.value = true;
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
