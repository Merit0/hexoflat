<template>
  <tool-hex-anchor
    v-slot="{ flipped }"
    :at="at"
    :origin="origin"
    :tile-width="tileWidth"
    :tile-height="tileHeight"
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
  </tool-hex-anchor>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getPrototype } from '@hexoflat/engine';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import ToolHexFace from '@/components/gui/tool-hex/tool-hex-face.vue';
import ToolHexAnchor from '@/components/gui/tool-hex/tool-hex-anchor.vue';
import type { QuestHandAction } from '@/services/quests/quest-field-model';

const props = defineProps<{
  at: IHexCoordinates;
  origin: IHexCoordinates;
  action: QuestHandAction | null;
  toolKey: THeroToolKey;
  tileWidth: number;
  tileHeight: number;
  working: boolean;
}>();
const emit = defineEmits<{ act: []; hide: [] }>();
const { t } = useI18n();

const iconPath = computed(() => getPrototype(props.toolKey).spritePath ?? '');
const label = computed(() => {
  if (props.action === 'exit') return t('quest.portal.enter');
  if (props.action === 'eye') return t('tool.read');
  return props.action === 'take' ? t('battle.tool.take') : null;
});
</script>
