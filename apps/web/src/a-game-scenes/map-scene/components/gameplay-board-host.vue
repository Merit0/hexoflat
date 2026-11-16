<template>
  <div class="gameplay-board" :data-active-map="active.kind">
    <world-map-board
      v-if="active.kind === 'world'"
      ref="worldBoard"
      :stage-element="stageElement"
    />
    <quest-field-area v-else-if="active.kind === 'quest'" :reference-frame="worldFrame" />
    <battle-board-area v-else :reference-frame="worldFrame" />
    <div
      v-if="active.kind === 'world' && world.worldLoadFailed"
      class="world-load-error"
      role="alert"
      data-testid="world-load-error"
    >
      <p>{{ t('world.loadError') }}</p>
      <button type="button" data-testid="world-load-retry" @click="world.retryWorldLoad()">
        {{ t('world.retry') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useActiveMapContext } from '@/composables/use-active-map-context';
import { useHexHoverInfo } from '@/composables/use-hex-hover-info';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { lootFlying } from '@/services/loot/loot-flight-state';
import { IDENTITY_CAMERA } from '@/render/board-camera';
import WorldMapBoard from './world-map-board.vue';
import QuestFieldArea from '@/components/quest/quest-field-area.vue';
import BattleBoardArea from './battle/battle-board-area.vue';

defineProps<{ stageElement: HTMLElement | null }>();
const { t } = useI18n();
const active = useActiveMapContext();
const world = useWorldMapStore();
const tool = useHeroToolStore();
const hover = useHexHoverInfo();
const worldBoard = ref<InstanceType<typeof WorldMapBoard> | null>(null);
const worldFrame = computed(() =>
  world.map ? { width: world.map.width, height: world.map.height } : null,
);
const worldCamera = computed(() => worldBoard.value?.camera ?? IDENTITY_CAMERA);
const worldCanvasSize = computed(() => worldBoard.value?.canvasSize ?? { width: 0, height: 0 });
const worldReady = computed(() => !!worldBoard.value?.isBoardReady && !lootFlying.value);

function syncSimulation() {
  if (active.value.kind === 'world') world.startWorldLoop();
  else world.stopWorldLoop();
}
watch(
  [
    () => active.value.kind,
    () => active.value.mapId,
    () => (active.value.kind === 'world' ? world.map : null),
  ],
  () => {
    hover.hide();
    tool.cancelLockedAction('MOVE');
    tool.stopTool();
    syncSimulation();
  },
  { immediate: true, flush: 'post' },
);
onBeforeUnmount(() => {
  hover.hide();
  tool.stopTool();
});
defineExpose({ worldCamera, worldCanvasSize, worldReady, syncSimulation });
</script>

<style scoped>
.gameplay-board {
  position: relative;
  width: 100%;
  height: 100%;
  background: #0b0d11;
}
.world-load-error {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  text-align: center;
  background: rgba(10, 8, 6, 0.85);
  color: #f2e6cf;
}
</style>
