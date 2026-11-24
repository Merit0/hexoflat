<template>
  <hex-info-popover :view="view" :anchor="target?.anchor ?? null" :hover-key="hoveredKey" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useActiveMapContext } from '@/composables/use-active-map-context';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useHexHoverInfo } from '@/composables/use-hex-hover-info';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { buildHexInfo } from '@/services/hex-info/build-hex-info';
import { tokenDescription } from '@/services/tokens/token-text';
import HexInfoPopover from './hex-info-popover.vue';

const i18n = useI18n();
const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params ?? {});
const te = (key: string) => i18n.te(key);
const activeMap = useActiveMapContext();
const heroToolStore = useHeroToolStore();
const { target } = useHexHoverInfo();

const hoveredKey = computed(() => {
  const coordinates = target.value?.coordinates;
  return coordinates ? `${coordinates.columnIndex}:${coordinates.rowIndex}` : null;
});

const view = computed(() => {
  const key = hoveredKey.value;
  if (
    !key ||
    activeMap.value.kind === 'battle' ||
    heroToolStore.isDragging ||
    knowledgePanelMode.value
  ) {
    return null;
  }
  const [columnIndex, rowIndex] = key.split(':').map(Number);
  const object = activeMap.value.objectAt({ columnIndex, rowIndex });
  if (!object) return null;
  const info = buildHexInfo(object, t(`itemTooltip.group.${object.groupType}`), t, te);
  if (object.groupType !== EHexobjectGroup.TOOL && object.groupType !== EHexobjectGroup.EQUIPMENT) {
    return info;
  }
  const { token, description } = object;
  const catalogue = description && te(description) ? t(description) : (description ?? null);
  return {
    ...info,
    kind: '',
    subtitle: null,
    description: token?.uniqueKey ? tokenDescription(token)[0] : catalogue,
    stats: [],
    tags: [],
    actions: [],
    headline: null,
  };
});
</script>
