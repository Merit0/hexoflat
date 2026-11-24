<template>
  <div ref="area" class="quest-area" data-testid="quest-field-area">
    <div
      ref="pane"
      class="quest-board"
      data-testid="quest-field"
      data-map-id="treasure-seeker-map"
      :data-ready="ready && !lootFlying"
    >
      <canvas ref="canvas" class="quest-board__canvas" />
    </div>
    <board-overlay-layer v-if="camera" :camera="camera" :frame-rect="null">
      <quest-tool-hex
        v-if="tool"
        :at="tool.at"
        :hero-hex="tool.heroHex"
        :action="tool.action"
        :tool-key="tool.toolKey"
        :tile-width="tileScreenSize(camera).w"
        :tile-height="tileScreenSize(camera).h"
        :working="handWorking"
        @act="actWithTool"
        @hide="heroTool.stopTool()"
      />
    </board-overlay-layer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useQuestBoard } from '@/render/quest/use-quest-board';
import { useQuestRunView } from '@/composables/use-quest-run-view';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import {
  EMPTY_FIELD,
  questHandAction,
  resolveFieldClick,
} from '@/services/quests/quest-field-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { lootFlying } from '@/services/loot/loot-flight-state';
import { questHandDurationMs } from '@/services/quests/quest-hand-duration';
import { useHexHoverInfo } from '@/composables/use-hex-hover-info';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import QuestToolHex from './quest-tool-hex.vue';
import { tileScreenSize, type BoardCamera, type BoardFrame } from '@/render/board-camera';
import BoardOverlayLayer from '@/components/gui/board/board-overlay-layer.vue';
import { useHexBoardInput } from '@/composables/use-hex-board-input';

const props = defineProps<{ referenceFrame?: BoardFrame | null }>();
const area = ref<HTMLElement | null>(null);
const pane = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const ready = ref(false);
const { field, run } = useQuestRunView();
const { click, openChest, pickUp, pause: pauseQuest } = useQuestRunActions();
const camera = ref<BoardCamera | null>(null);
const hoveredTileCoord = ref<IHexCoordinates | null>(null);
const heroCoordinates = computed(() => run.value?.projection.position ?? null);
const acceptsTools = computed(() => {
  const phase = run.value?.projection.phase;
  return phase === 'walking' || phase === 'collect';
});
useHexBoardInput({
  surface: area,
  hoveredTileCoord,
  heroCoordinates,
  enabled: acceptsTools,
  blocked: computed(() => lootFlying.value),
});
const hexHoverInfo = useHexHoverInfo();
const heroTool = useHeroToolStore();
watch(heroCoordinates, (at, before) => {
  if (!at || !before || (at.columnIndex === before.columnIndex && at.rowIndex === before.rowIndex))
    return;
  if (heroTool.isDragging && heroTool.activeTool) {
    heroTool.useTool(heroTool.activeTool, at, heroTool.hover);
  }
});
const model = computed(() => field.value ?? EMPTY_FIELD);
const tool = computed(() => {
  const projection = run.value?.projection;
  const toolKey = heroTool.activeTool;
  if (!projection || !toolKey || !heroTool.isDragging || lootFlying.value) return null;
  if (!acceptsTools.value) return null;
  const at = heroTool.hover;
  if (!at) return null;
  const action = toolKey === HEXOBJECT_KEYS.HAND ? questHandAction(projection, at) : null;
  return { at, heroHex: projection.position, action, toolKey };
});

const handWorking = ref(false);
let cancelWait: (() => void) | null = null;
let disposed = false;

function pause(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cancelWait = null;
      resolve(true);
    }, ms);
    cancelWait = () => {
      window.clearTimeout(timer);
      cancelWait = null;
      resolve(false);
    };
  });
}

watch(
  () => run.value?.projection,
  () => cancelWait?.(),
  { flush: 'sync' },
);
watch(
  () => heroTool.isDragging,
  (dragging) => {
    if (!dragging) cancelWait?.();
  },
);
onBeforeUnmount(() => {
  hexHoverInfo.hide();
  disposed = true;
  cancelWait?.();
  heroTool.stopTool();
});

async function actWithTool() {
  const current = tool.value;
  const projection = run.value?.projection;
  if (!current?.action || !projection || handWorking.value) return;
  handWorking.value = true;
  heroTool.holdTool();
  try {
    const completed = await pause(questHandDurationMs(projection, current.at, current.action));
    if (!completed || disposed || run.value?.projection !== projection) return;
    await (current.action === 'exit'
      ? pauseQuest()
      : current.action === 'eye'
        ? openChest()
        : pickUp(current.at));
  } finally {
    handWorking.value = false;
    heroTool.releaseTool();
  }
}

onMounted(() => heroTool.stopTool());

useQuestBoard({
  pane,
  canvas,
  model,
  referenceFrame: computed(() => props.referenceFrame ?? null),
  onCamera: (value) => {
    camera.value = value;
  },
  onReady: () => {
    ready.value = true;
  },
  onHexTap: (hex) => {
    const projection = run.value?.projection;
    if (heroTool.isDragging) return;
    if (projection) void click(resolveFieldClick(projection, hex));
  },
  onHexPointer: (hex, anchor) => {
    if (hex && anchor) hexHoverInfo.show(hex, anchor);
    else hexHoverInfo.hide();
    hoveredTileCoord.value = hex;
    if (hex && !handWorking.value) heroTool.updateHover(hex);
  },
});
</script>

<style scoped>
.quest-area,
.quest-board {
  position: relative;
  width: 100%;
  height: 100%;
}
.quest-board {
  overflow: hidden;
  background: #0f0e12;
}
.quest-board__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
