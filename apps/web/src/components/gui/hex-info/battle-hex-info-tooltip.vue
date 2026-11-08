<template>
  <hex-info-popover :view="view" :anchor="target?.anchor ?? null" :hover-key="hoveredKey" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { hexKey } from '@hexoflat/engine/battle/hex-battle-geom';
import { useBattleHexHover } from '@/composables/use-battle-hex-hover';
import {
  buildBattleHexInfo,
  type BattleHexInfoScene,
} from '@/services/hex-info/build-battle-hex-info';
import HexInfoPopover from './hex-info-popover.vue';

const props = defineProps<{ scene: BattleHexInfoScene }>();

const i18n = useI18n();
const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params ?? {});
const te = (key: string) => i18n.te(key);
const { target } = useBattleHexHover();

const hoveredKey = computed(() => (target.value ? hexKey(target.value.hex) : null));

const view = computed(() => {
  const hovered = target.value;
  return hovered ? buildBattleHexInfo(hovered.hex, props.scene, t, te) : null;
});
</script>
