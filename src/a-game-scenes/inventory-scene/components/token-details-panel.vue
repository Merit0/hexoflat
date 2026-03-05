<template>
  <div class='panel'>
    <div class='top'>
      <div class='thumb' :style='thumbStyle'></div>

      <div class='meta'>
        <div class='title'>{{ traits.title }}</div>
        <div class='sub'>{{ item.key }}</div>
      </div>
    </div>

    <div class='desc'>
      {{ traits.description || 'No description yet.' }}
    </div>

    <div class='row'>
      <div class='pill'>Type: {{ item.type }}</div>
      <div v-if='item.equipSlot' class='pill'>Slot: {{ item.equipSlot }}</div>
      <div v-if='item.amount > 1' class='pill'>Amount: {{ item.amount }}</div>
    </div>

    <div class='actions'>
      <button class='btn' disabled>Use</button>
      <button class='btn' disabled>Equip</button>
      <button class='btn' disabled>Drop</button>
    </div>
  </div>
</template>

<script setup lang='ts'>
import {computed} from 'vue';
import type {InventoryItem} from '@/stores/hero-inventory-store';
import {resolveInventoryView} from "@/utils/inventory/traits-resolver";
import {EHexobjectGroup} from "@/abstraction/hexobject-abstraction";

const props = defineProps<{ item: InventoryItem }>();

const traits = computed(() => resolveInventoryView(props.item.key));

const thumbStyle = computed(() => ({
  backgroundImage: traits.value.iconPath ? `url('${traits.value.iconPath}')` : 'none',
}));

const actions = computed(() => {
  if (!props.item) return [];
  const a: Array<{ key: 'use' | 'equip' | 'drop'; label: string; disabled?: boolean }> = [];

  if (props.item.type === EHexobjectGroup.LOOT) a.push({ key: 'use', label: 'USE' });
  if (props.item.type === EHexobjectGroup.EQUIPMENT && props.item.equipSlot) a.push({ key: 'equip', label: 'EQUIP' });

  a.push({ key: 'drop', label: 'DROP' });
  return a;
});

</script>

<style scoped>
.panel {
  width: 470px;
  min-height: 380px;
  border-radius: 10px;

  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset,
  0 26px 70px rgba(0, 0, 0, 0.70);

  padding: 14px;
  color: rgba(255, 255, 255, 0.86);
  pointer-events: auto;
}

.top {
  display: flex;
  gap: 12px;
  align-items: center;
}

.thumb {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.55);
}

.meta .title {
  font-weight: 1000;
  letter-spacing: 0.04em;
  font-size: 16px;
}

.meta .sub {
  margin-top: 3px;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.08em;
  opacity: 0.65;
}

.desc {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
  min-height: 86px;
  line-height: 1.35;
}

.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.pill {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
  font-weight: 900;
  font-size: 11px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  justify-content: flex-end;
}

.btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 11px;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>