<template>
  <div
      class="token"
      :class="{ 'is-selected': isSelected }"
      :style="tokenStyle"
      @click="onClick"
  >
    <span v-if="item.isNew" class="badge">NEW</span>

    <div class="icon" :style="iconStyle"></div>

    <span v-if="showAmount" class="amount">x{{ item.amount }}</span>
  </div>
</template>

<script setup lang="ts">
import {computed} from "vue";
import {useHeroInventoryStore, type InventoryItem} from "@/stores/hero-inventory-store";
import {resolveInventoryView} from "@/utils/inventory/traits-resolver";

const props = defineProps<{ item: InventoryItem }>();

const isSelected = computed(() => inv.selectedItemId === props.item.id);

const inv = useHeroInventoryStore();

const rotation = computed(() => inv.ensureRotation(props.item.id));

const meta = computed(() => resolveInventoryView(props.item.key));

const showAmount = computed(() => (props.item.amount ?? 1) > 1);

const tokenStyle = computed(() => ({
  "--rot": `${rotation.value}deg`,
}));

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
  width: 100%;
  height: 100%;
  display: block;

  transform: translate(-50%, -50%) rotate(var(--rot)) scale(1);
  transform-origin: center center;

  cursor: pointer;
  transition: transform 0.16s ease, filter 0.16s ease;
}

.token:hover,
.token.is-selected {
  transform:
      translate(-50%, -50%)
      rotate(0deg)
      scale(1.06);
  z-index: 5;
  filter: brightness(1.08);
}

.badge {
  position: absolute;
  top: -8px;
  left: -8px;
  padding: 4px 8px;
  border-radius: 999px;

  background: rgba(255, 0, 120, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: white;

  font-weight: 900;
  font-size: 10px;
  letter-spacing: 0.08em;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4);
  will-change: transform;
}

.icon {
  position: absolute;
  inset: 0;

  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;

  filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.55));
}

.amount {
  position: absolute;
  right: 8px;
  bottom: 6px;

  padding: 3px 8px;
  border-radius: 999px;

  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);

  font-weight: 900;
  font-size: 11px;
}
</style>