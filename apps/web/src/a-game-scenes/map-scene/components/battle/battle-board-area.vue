<template>
  <div class="battle-area" data-testid="battle-board-area">
    <battle-board
      v-if="view.board"
      class="battle-area__board"
      :scene="view.board.scene"
      :overlay="view.board.overlay"
      :banner="view.board.banner"
      :preview="view.board.preview"
      :reference-frame="referenceFrame"
      :take-events="store.takeEvents"
      @hex-tap="tapHex"
      @hex-hover="hoverHex"
      @animating="store.setAnimating"
      @camera="camera = $event"
    >
      <board-overlay-layer v-if="camera && frame" :camera="camera" :frame-rect="frame">
        <battle-tool-hex
          v-if="view.board.tool && !store.animating"
          :tool="view.board.tool"
          :biome="view.board.scene.biome"
          :tile-width="tileSize.w"
          :tile-height="tileSize.h"
          @act="strikeWithTool"
          @hide="hideTool"
        />
      </board-overlay-layer>
      <battle-timed-task v-if="view.task" :task="view.task" @answer="answer" @timeout="timeout" />
    </battle-board>
    <battle-board-legend />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import BattleBoard from '@/components/battle/battle-board.vue';
import BattleBoardLegend from '@/components/battle/battle-board-legend.vue';
import { useBattleView } from '@/composables/use-battle-view';
import { useBattleStore } from '@/stores/battle-store';
import {
  frameWorldRect,
  tileScreenSize,
  type BoardCamera,
  type BoardFrame,
} from '@/render/board-camera';
import BattleTimedTask from './battle-timed-task.vue';
import BattleToolHex from './battle-tool-hex.vue';
import BoardOverlayLayer from '@/components/gui/board/board-overlay-layer.vue';
import { BATTLEFIELD_BIOMES } from '@hexoflat/engine/battle/battlefield';

defineProps<{ referenceFrame: BoardFrame | null }>();

const store = useBattleStore();
const camera = ref<BoardCamera | null>(null);
const frame = computed(() => {
  const biome = view.value.board?.scene.biome;
  if (!biome) return null;
  const { columns, rows } = BATTLEFIELD_BIOMES[biome].frame;
  return frameWorldRect({ width: columns, height: rows });
});
const tileSize = computed(() => tileScreenSize(camera.value ?? { x: 0, y: 0, zoom: 1 }));
const { view, tapHex, hoverHex, answer, timeout, strikeWithTool, hideTool } = useBattleView();
</script>

<style scoped>
.battle-area {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.battle-area__board {
  flex: 1;
  min-height: 0;
}
</style>
