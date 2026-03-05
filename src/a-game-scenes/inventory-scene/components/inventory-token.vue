<template>
  <button
      class="token"
      :class="{ 'is-selected': isSelected }"
      :style="tokenStyle"
      @click="onClick"
  >
    <span v-if="item.isNew" class="badge">NEW</span>

    <div class="icon" :style="iconStyle"></div>

    <span v-if="showAmount" class="amount">x{{ item.amount }}</span>
  </button>
</template>

<script setup lang="ts">
import {computed} from "vue";
import {useHeroInventoryStore, type InventoryItem} from "@/stores/hero-inventory-store";
import {resolveItemTraits} from "@/utils/inventory/traits-resolver";

const props = defineProps<{ item: InventoryItem }>();

const isSelected = computed(() => inv.selectedItemId === props.item.id);

const inv = useHeroInventoryStore();

const rotation = computed(() => inv.ensureRotation(props.item.id));

const meta = computed(() => resolveItemTraits(props.item.key));

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

  transform:
      translate(-50%, -50%)
      rotate(var(--rot))
      scale(1);

  transform-origin: center center;

  width: 90%;
  height: 90%;
  border-radius: 14px;

  border: 1px solid rgba(0,0,0,0.35);
  background: rgba(0,0,0,0.22);

  box-shadow:
      0 10px 22px rgba(0,0,0,0.28),
      0 0 0 1px rgba(255,255,255,0.07) inset;

  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
  cursor: pointer;
}

/* hover OR selected => same pose */
.token:hover,
.token.is-selected {
  transform:
      translate(-50%, -50%)
      rotate(0deg)
      scale(1.06);

  z-index: 5;

  box-shadow:
      0 22px 46px rgba(0,0,0,0.55),
      0 0 0 1px rgba(255,255,255,0.10) inset;
}

/* optional: якщо selected, можна прибрати реакцію на hover (не треба) */

.token:hover,
.token.is-selected {
  transform:
      translate(-50%, -50%)
      rotate(0deg)
      scale(1.06);

  z-index: 5;

  box-shadow:
      0 22px 46px rgba(0,0,0,0.55),
      0 0 0 1px rgba(255,255,255,0.10) inset;
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
}

.icon {
  position: absolute;
  inset: 10px 10px 16px 10px;

  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;

  filter: drop-shadow(0 10px 16px rgba(0, 0, 0, 0.55));
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

.cell.selected {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.95),
  0 0 0 6px rgba(255, 255, 255, 0.10),
  0 18px 40px rgba(0, 0, 0, 0.55);
  border-color: rgba(255, 255, 255, 0.65);
}
</style>