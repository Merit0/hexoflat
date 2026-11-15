<template>
  <div class="quest-area" data-testid="quest-field-area">
    <div
      ref="pane"
      class="quest-board"
      data-testid="quest-field"
      :data-ready="ready && !lootFlying"
    >
      <canvas ref="canvas" class="quest-board__canvas" />
    </div>
    <quest-tool-hex
      v-if="tool && camera"
      :at="tool.at"
      :origin="tool.origin"
      :action="tool.action"
      :tool-key="tool.toolKey"
      :camera="camera"
      :working="handWorking"
      @act="actWithTool"
      @hide="heroTool.stopTool()"
    />
    <quest-hex-tip v-if="tip && !tool" :tip="tip" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuestBoard } from '@/render/quest/use-quest-board';
import { useQuestRunView } from '@/composables/use-quest-run-view';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import {
  EMPTY_FIELD,
  questHandAction,
  questToolHexAt,
  resolveFieldClick,
} from '@/services/quests/quest-field-model';
import { buildQuestHexTip } from '@/services/quests/quest-hex-tip';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { TileAnchor } from '@/render/layers/tiles-layer';
import { getMeta } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { lootFlying } from '@/services/loot/loot-flight-state';
import { questHandDurationMs } from '@/services/quests/quest-hand-duration';
import QuestHexTip from './quest-hex-tip.vue';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import QuestToolHex from './quest-tool-hex.vue';
import type { BoardCamera } from '@/render/board-camera';

const i18n = useI18n();
const { t } = i18n;
function localizedTitle(key: THexobjectKey): string {
  const title = getMeta(key).title;
  return i18n.te(title) ? t(title) : title;
}
const pane = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const ready = ref(false);
const { field, run } = useQuestRunView();
const { click, openChest, pickUp } = useQuestRunActions();
const camera = ref<BoardCamera | null>(null);
const lastPointer = ref<IHexCoordinates | null>(null);
const hover = ref<{ hex: IHexCoordinates; anchor: TileAnchor } | null>(null);
const heroTool = useHeroToolStore();
const model = computed(() => field.value ?? EMPTY_FIELD);
const tip = computed(() => {
  const current = hover.value;
  if (!current || !field.value) return null;
  const text = buildQuestHexTip(field.value, current.hex);
  if (!text) return null;
  const item = text.item ? localizedTitle(text.item as THexobjectKey) : '';
  return { anchor: current.anchor, label: t(text.key, { ...text.params, item }) };
});
const tool = computed(() => {
  const projection = run.value?.projection;
  const toolKey = heroTool.activeTool;
  if (!projection || !toolKey || !heroTool.isDragging || lootFlying.value) return null;
  const at = questToolHexAt(projection, hover.value?.hex ?? lastPointer.value);
  if (!at) return null;
  const action = toolKey === HEXOBJECT_KEYS.HAND ? questHandAction(projection, at) : null;
  return { at, origin: projection.position, action, toolKey };
});

const handWorking = ref(false);

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function actWithTool() {
  const current = tool.value;
  const projection = run.value?.projection;
  if (!current?.action || !projection || handWorking.value) return;
  handWorking.value = true;
  heroTool.holdTool();
  try {
    await pause(questHandDurationMs(projection, current.at, current.action));
    await (current.action === 'eye' ? openChest() : pickUp(current.at));
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
    hover.value = hex && anchor ? { hex, anchor } : null;
    if (hex) lastPointer.value = hex;
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
