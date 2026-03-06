<template>
  <div
      class="token"
      :class="{ 'is-selected': isSelected }"
      :style="tokenStyle"
      @click="onClick"
  >
    <div class="icon" :style="iconStyle"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useHeroInventoryStore, type InventoryItem } from "@/stores/hero-inventory-store";
import { resolveInventoryView } from "@/utils/inventory/traits-resolver";

const props = defineProps<{ item: InventoryItem }>();
const inv = useHeroInventoryStore();

const isSelected = computed(() => inv.selectedItemId === props.item.id);
const rotation = computed(() => inv.ensureRotation(props.item.id));
const meta = computed(() => resolveInventoryView(props.item.key));

const tokenStyle = computed(() => ({ "--rot": `${rotation.value}deg` }));
const iconStyle = computed(() => ({
  backgroundImage: meta.value.iconPath ? `url("${meta.value.iconPath}")` : "none",
}));

function onClick() {
  inv.toggleSelect(props.item.id);
}
</script>

<style scoped>
.token {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 110%;
  height: 110%;
  display: block;

  transform: translate(-50%, -50%) rotate(var(--rot)) scale(1);
  transform-origin: center center;

  cursor: pointer;
  transition: transform 0.16s ease, filter 0.16s ease;
  will-change: transform;
}

.token:hover,
.token.is-selected {
  transform: translate(-50%, -50%) rotate(0deg) scale(1.06);
  z-index: 5;
  filter: brightness(1.08);
}

.icon {
  position: absolute;
  inset: 0;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.55));
}
</style>