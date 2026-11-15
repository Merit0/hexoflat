<template>
  <div
    class="quest-tool-pos"
    :style="style"
    data-testid="quest-tool-hex"
    :data-at="`${at.columnIndex},${at.rowIndex}`"
  >
    <tool-hex-face
      :icon-path="iconPath"
      :flipped="flipped"
      :working="working"
      :label="label"
      :read="action === 'eye'"
      :denied="false"
      :can-afford="true"
      @act="emit('act')"
      @hide="emit('hide')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getPrototype } from '@hexoflat/engine';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import ToolHexFace from '@/components/gui/tool-hex/tool-hex-face.vue';
import {
  HEX_WORLD_HEIGHT,
  HEX_WORLD_WIDTH,
  tileWorldCenter,
  worldToScreen,
  type BoardCamera,
} from '@/render/board-camera';
import type { QuestHandAction } from '@/services/quests/quest-field-model';

const props = defineProps<{
  at: IHexCoordinates;
  origin: IHexCoordinates;
  action: QuestHandAction | null;
  toolKey: THeroToolKey;
  camera: BoardCamera;
  working: boolean;
}>();
const emit = defineEmits<{ act: []; hide: [] }>();
const { t } = useI18n();

const iconPath = computed(() => getPrototype(props.toolKey).spritePath ?? '');
const flipped = computed(() => {
  const target = tileWorldCenter(props.at);
  return target.x < tileWorldCenter(props.origin).x;
});
const label = computed(() => {
  if (props.action === 'eye') return t('tool.read');
  return props.action === 'take' ? t('battle.tool.take') : null;
});

const style = computed(() => {
  const width = HEX_WORLD_WIDTH * props.camera.zoom;
  const height = HEX_WORLD_HEIGHT * props.camera.zoom;
  const centre = worldToScreen(props.camera, tileWorldCenter(props.at));
  return {
    '--hex-tile-width': `${width}px`,
    '--hex-tile-height': `${height}px`,
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(${Math.round(centre.x - width / 2)}px, ${Math.round(centre.y - height / 2)}px)`,
  };
});
</script>

<style scoped>
.quest-tool-pos {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
  pointer-events: none;
}
.quest-tool-pos :deep(.tool-hex-tile) {
  pointer-events: auto;
}
</style>
