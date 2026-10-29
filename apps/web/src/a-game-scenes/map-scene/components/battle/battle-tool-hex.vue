<template>
  <tool-hex-anchor
    v-slot="{ flipped }"
    :at="at"
    :origin="origin"
    :tile-width="tileWidth"
    :tile-height="tileHeight"
    data-testid="battle-tool-hex"
  >
    <tool-hex-face
      :icon-path="iconPath"
      :flipped="flipped"
      :working="false"
      :label="label"
      :read="false"
      :denied="false"
      :can-afford="tool.canAfford"
      @act="emit('act')"
      @hide="emit('hide')"
    />
  </tool-hex-anchor>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getPrototype } from '@hexoflat/engine';
import { battleHexToOffset, type BattlefieldBiome } from '@hexoflat/engine/battle/battlefield';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import ToolHexAnchor from '@/components/gui/tool-hex/tool-hex-anchor.vue';
import ToolHexFace from '@/components/gui/tool-hex/tool-hex-face.vue';
import type { BattleToolHex } from '@/composables/battle-tool-hex';

const props = defineProps<{
  tool: BattleToolHex;
  biome: BattlefieldBiome;
  tileWidth: number;
  tileHeight: number;
}>();

const emit = defineEmits<{ act: []; hide: [] }>();
const { t } = useI18n();

const at = computed(() => battleHexToOffset(props.biome, props.tool.at));
const origin = computed(() => battleHexToOffset(props.biome, props.tool.origin));
const iconPath = computed(() => getPrototype(props.tool.toolKey as THexobjectKey).spritePath ?? '');
const label = computed(() => {
  if (props.tool.action === 'attack') return t('battle.tool.attack');
  if (props.tool.action === 'block') return t('battle.tool.block');
  if (props.tool.action === 'unblock') return t('battle.tool.unblock');
  return null;
});
</script>
