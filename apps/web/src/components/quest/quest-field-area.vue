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
    <quest-hex-tip v-if="tip" :tip="tip" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuestBoard } from '@/render/quest/use-quest-board';
import { useQuestRunView } from '@/composables/use-quest-run-view';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import { EMPTY_FIELD, resolveFieldClick } from '@/services/quests/quest-field-model';
import { buildQuestHexTip } from '@/services/quests/quest-hex-tip';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { TileAnchor } from '@/render/layers/tiles-layer';
import { getMeta } from '@hexoflat/engine';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { lootFlying } from '@/services/loot/loot-flight-state';
import QuestHexTip from './quest-hex-tip.vue';

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
const { click } = useQuestRunActions();
const hover = ref<{ hex: IHexCoordinates; anchor: TileAnchor } | null>(null);

const model = computed(() => field.value ?? EMPTY_FIELD);
const tip = computed(() => {
  const current = hover.value;
  if (!current || !field.value) return null;
  const text = buildQuestHexTip(field.value, current.hex);
  if (!text) return null;
  const item = text.item ? localizedTitle(text.item as THexobjectKey) : '';
  return { anchor: current.anchor, label: t(text.key, { ...text.params, item }) };
});

useQuestBoard({
  pane,
  canvas,
  model,
  onReady: () => {
    ready.value = true;
  },
  onHexTap: (hex) => {
    const projection = run.value?.projection;
    if (projection) void click(resolveFieldClick(projection, hex));
  },
  onHexPointer: (hex, anchor) => {
    hover.value = hex && anchor ? { hex, anchor } : null;
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
