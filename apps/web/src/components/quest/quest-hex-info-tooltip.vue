<template>
  <hex-info-popover :view="view" :anchor="anchor" :hover-key="hoveredKey" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { TileAnchor } from '@/render/layers/tiles-layer';
import HexInfoPopover from '@/components/gui/hex-info/hex-info-popover.vue';
import { buildHexInfo } from '@/services/hex-info/build-hex-info';
import type { QuestFieldModel } from '@/services/quests/quest-field-model';
import { questHoverObject } from '@/services/quests/quest-hover-object';

const props = defineProps<{
  model: QuestFieldModel;
  hover: { hex: IHexCoordinates; anchor: TileAnchor } | null;
}>();

const i18n = useI18n();
const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params ?? {});
const te = (key: string) => i18n.te(key);

const anchor = computed(() => props.hover?.anchor ?? null);
const hoveredKey = computed(() => (props.hover ? coordinateKey(props.hover.hex) : null));
const view = computed(() => {
  const hovered = props.hover;
  const object = hovered ? questHoverObject(props.model, hovered.hex) : null;
  return object ? buildHexInfo(object, t(`itemTooltip.group.${object.groupType}`), t, te) : null;
});
</script>
