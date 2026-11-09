import { defineStore } from 'pinia';
import { HEXOBJECT_KEYS, THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import {
  EHexobjectGroup,
  type TEquipSlot,
} from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { migrateLegacyInventory } from '@hexoflat/engine/inventory/inventory-migration';
import { calculateCarriedWeightKg } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { randomTokenRotationDeg } from '@/render/token-utils';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { bindInventoryHandsGate, moveBySlot } from '@/services/inventory/inventory-moves';
import {
  bagItemsOf,
  consumeItem,
  grantItem,
  LOCAL_HERO_ID,
} from '@/services/inventory/inventory-store-io';
import {
  clearInventoryRecord,
  patchInventoryRecord,
  readInventoryRecord,
} from '@/services/persistence/inventory-record-storage';

export { bindInventoryHandsGate };

export type { TEquipSlot };
export type { InventoryItem };

export interface GridConfig {
  cols: number;
  rows: number;
  blockedRect: { x: number; y: number; w: number; h: number };
}

function slotKey(r: number, c: number) {
  return `r${r}c${c}`;
}

export function equipSlotKey(slot: TEquipSlot) {
  return `eq:${slot}`;
}

export const WILL_SLOT_KEY = slotKey(0, 0);

function isBlocked(r: number, c: number, cfg: GridConfig) {
  const { x, y, w, h } = cfg.blockedRect;
  return c >= x && c < x + w && r >= y && r < y + h;
}

function emptyRotations(): Record<string, number> {
  return {};
}

export const useHeroInventoryStore = defineStore('heroInventory', {
  state: () => ({
    grid: {
      cols: 12,
      rows: 7,
      blockedRect: { x: 3, y: 1, w: 6, h: 5 },
    },

    items: [] as InventoryItem[],
    selectedItemId: null as string | null,

    rotationsById: emptyRotations(),

    carryCapacityKg: 10,

    isHydrated: false,
  }),

  getters: {
    equippedItems(state): Record<TEquipSlot, InventoryItem | null> {
      return {
        weapon: state.items.find((i) => i.slotKey === equipSlotKey('weapon')) ?? null,
        shield: state.items.find((i) => i.slotKey === equipSlotKey('shield')) ?? null,
        armor: state.items.find((i) => i.slotKey === equipSlotKey('armor')) ?? null,
        gloves: state.items.find((i) => i.slotKey === equipSlotKey('gloves')) ?? null,
        helm: state.items.find((i) => i.slotKey === equipSlotKey('helm')) ?? null,
        boots: state.items.find((i) => i.slotKey === equipSlotKey('boots')) ?? null,
        ring: state.items.find((i) => i.slotKey === equipSlotKey('ring')) ?? null,
        amulet: state.items.find((i) => i.slotKey === equipSlotKey('amulet')) ?? null,
      };
    },

    selectedItem(state): InventoryItem | null {
      return state.items.find((i) => i.id === state.selectedItemId) ?? null;
    },

    itemsBySlot(state): Record<string, InventoryItem> {
      const map: Record<string, InventoryItem> = {};
      for (const it of state.items) map[it.slotKey] = it;
      return map;
    },

    allSlotKeys(state): string[] {
      const out: string[] = [];
      for (let r = 0; r < state.grid.rows; r++) {
        for (let c = 0; c < state.grid.cols; c++) {
          out.push(slotKey(r, c));
        }
      }
      return out;
    },

    freeSlotKeys(state): string[] {
      const occ = new Set(state.items.map((i) => i.slotKey));
      const out: string[] = [];

      for (let r = 0; r < state.grid.rows; r++) {
        for (let c = 0; c < state.grid.cols; c++) {
          if (isBlocked(r, c, state.grid)) continue;
          const key = slotKey(r, c);
          if (key !== WILL_SLOT_KEY && !occ.has(key)) out.push(key);
        }
      }

      return out;
    },

    carriedWeightKg(state): number {
      return calculateCarriedWeightKg(state.items);
    },

    remainingCapacityKg(): number {
      return Math.max(0, this.carryCapacityKg - this.carriedWeightKg);
    },

    isOverCapacity(): boolean {
      return this.carriedWeightKg > this.carryCapacityKg;
    },
  },

  actions: {
    hydrate() {
      if (this.isHydrated) return;

      const saved = readInventoryRecord().bag;
      const legacy = saved ? { items: saved.items, carryCapacityKg: saved.carryCapacityKg } : null;
      const { state } = migrateLegacyInventory(LOCAL_HERO_ID, legacy, null);
      const before = new Map((saved?.items ?? []).map((item) => [item.id, item]));
      this.items = bagItemsOf(state, before).map((item) => ({
        ...item,
        isNew: before.get(item.id)?.isNew ?? false,
      }));
      if (saved) {
        this.rotationsById = saved.rotationsById;
        this.carryCapacityKg = saved.carryCapacityKg;
      }
      for (const item of this.items) this.ensureRotation(item.id);

      this.fillEmptySlotsWithHands();
      if (!saved) this.persist();
      this.selectedItemId = null;
      this.isHydrated = true;
    },

    persist() {
      patchInventoryRecord({
        bag: {
          items: this.items,
          rotationsById: this.rotationsById,
          carryCapacityKg: this.carryCapacityKg,
        },
      });
    },

    clearPersistence() {
      clearInventoryRecord();
    },

    rerollRotation(id: string) {
      this.rotationsById[id] = randomTokenRotationDeg();
      return this.rotationsById[id];
    },

    unequipHand(slot: 'weapon' | 'shield'): boolean {
      const item = this.equippedItems[slot];
      if (!item || item.key === HEXOBJECT_KEYS.HAND) return false;
      const target = this.freeSlotKeys[0];
      if (!target) return false;
      this.moveItemToSlot(item.id, target);
      return this.equippedItems[slot]?.id !== item.id;
    },

    moveItemToSlot(itemId: string, targetSlotKey: string) {
      moveBySlot({ inventory: this, stash: useHeroStashStore() }, itemId, targetSlotKey);
    },

    isCellBlocked(r: number, c: number) {
      return isBlocked(r, c, this.grid);
    },

    ensureRotation(id: string) {
      if (this.rotationsById[id] == null) {
        this.rotationsById[id] = randomTokenRotationDeg();
      }
      return this.rotationsById[id];
    },

    toggleSelect(id: string) {
      this.selectedItemId = this.selectedItemId === id ? null : id;

      const it = this.items.find((x) => x.id === id);
      if (it && it.isNew) {
        it.isNew = false;
        this.persist();
      }
    },

    clearSelection() {
      this.selectedItemId = null;
    },

    putToInventory(key: THexobjectKey, amount = 1) {
      return grantItem({ inventory: this, stash: useHeroStashStore() }, key, amount, 'pickup');
    },

    countItem(key: THexobjectKey): number {
      return this.items.reduce((sum, item) => (item.key === key ? sum + item.amount : sum), 0);
    },

    takeFromInventory(key: THexobjectKey, amount: number) {
      return consumeItem({ inventory: this, stash: useHeroStashStore() }, key, amount);
    },

    fillEmptySlotsWithHands() {
      const hasWeaponItem = this.items.some((i) => i.slotKey === 'eq:weapon');
      const hasShieldItem = this.items.some((i) => i.slotKey === 'eq:shield');

      if (!hasWeaponItem) {
        const id = crypto.randomUUID();
        this.items.push({
          id,
          key: HEXOBJECT_KEYS.HAND,
          type: EHexobjectGroup.TOOL,
          amount: 1,
          slotKey: 'eq:weapon',
          isNew: false,
        });
        this.ensureRotation(id);
      }

      if (!hasShieldItem) {
        const id = crypto.randomUUID();
        this.items.push({
          id,
          key: HEXOBJECT_KEYS.HAND,
          type: EHexobjectGroup.TOOL,
          amount: 1,
          slotKey: 'eq:shield',
          isNew: false,
        });
        this.ensureRotation(id);
      }
    },
  },
});
