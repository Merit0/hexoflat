import { defineStore } from 'pinia';
import { HEXOBJECT_KEYS, THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import {
  EHexobjectGroup,
  type TEquipSlot,
} from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { getPrototype, getMeta } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import {
  calculateCarriedWeightKg,
  canFitAdditionalWeight,
  getItemUnitWeightKg,
  mergeItemStacks,
} from '@hexoflat/engine/utils/inventory/traits-resolver';
import { defaultRandom, pickRandom } from '@hexoflat/engine/utils/random';
import { randomTokenRotationDeg } from '@/render/token-utils';
import {
  clearSavedInventory,
  readSavedInventory,
  writeSavedInventory,
} from '@/services/persistence/inventory-storage';

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

function parseEquipSlotKey(value: string | null | undefined): TEquipSlot | null {
  if (!value) return null;
  if (!value.startsWith('eq:')) return null;

  const slot = value.slice(3) as TEquipSlot;

  if (
    slot === 'weapon' ||
    slot === 'shield' ||
    slot === 'armor' ||
    slot === 'gloves' ||
    slot === 'helm' ||
    slot === 'boots' ||
    slot === 'ring' ||
    slot === 'amulet'
  ) {
    return slot;
  }

  return null;
}

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
          if (!occ.has(key)) out.push(key);
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

      const saved = readSavedInventory();
      if (saved) {
        this.items = saved.items;
        this.rotationsById = saved.rotationsById;
        this.carryCapacityKg = saved.carryCapacityKg;
      }

      this.fillEmptySlotsWithHands();
      this.selectedItemId = null;
      this.isHydrated = true;
    },

    persist() {
      writeSavedInventory({
        items: this.items,
        rotationsById: this.rotationsById,
        carryCapacityKg: this.carryCapacityKg,
      });
    },

    clearPersistence() {
      clearSavedInventory();
    },

    rerollRotation(id: string) {
      this.rotationsById[id] = randomTokenRotationDeg();
      return this.rotationsById[id];
    },

    moveItemToSlot(itemId: string, targetSlotKey: string) {
      const fromItem = this.items.find((i) => i.id === itemId);
      if (!fromItem) return;

      if (fromItem.slotKey === targetSlotKey) return;

      if (fromItem.key === HEXOBJECT_KEYS.HAND) {
        return;
      }

      const targetItem = this.items.find((i) => i.slotKey === targetSlotKey);

      if (targetItem && targetItem.key === HEXOBJECT_KEYS.HAND) {
        const idx = this.items.findIndex((i) => i.id === targetItem.id);
        if (idx !== -1) {
          this.items.splice(idx, 1);
          delete this.rotationsById[targetItem.id];
        }

        fromItem.slotKey = targetSlotKey;
        this.rerollRotation(fromItem.id);

        this.fillEmptySlotsWithHands();
        this.persist();
        return;
      }

      if (!targetItem) {
        fromItem.slotKey = targetSlotKey;
        this.rerollRotation(fromItem.id);

        this.fillEmptySlotsWithHands();
        this.persist();
        return;
      }

      const targetEquip = parseEquipSlotKey(targetSlotKey);

      if (!targetEquip) {
        const merged = mergeItemStacks(targetItem, fromItem);

        if (merged) {
          targetItem.isNew = true;
          this.rerollRotation(targetItem.id);

          if (fromItem.amount <= 0) {
            const idx = this.items.findIndex((i) => i.id === fromItem.id);
            if (idx !== -1) this.items.splice(idx, 1);
            delete this.rotationsById[fromItem.id];
          } else {
            this.rerollRotation(fromItem.id);
          }

          this.fillEmptySlotsWithHands();
          this.persist();
          return;
        }
      }

      const oldSlot = fromItem.slotKey;
      fromItem.slotKey = targetSlotKey;
      targetItem.slotKey = oldSlot;

      this.rerollRotation(fromItem.id);
      this.rerollRotation(targetItem.id);

      this.fillEmptySlotsWithHands();
      this.persist();
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

    pickFreeSlot(): string | null {
      return pickRandom(this.freeSlotKeys, defaultRandom);
    },

    putToInventory(key: THexobjectKey, amount = 1) {
      if (key === HEXOBJECT_KEYS.HAND) {
        return { ok: false, message: 'Hand cannot be added to inventory.' };
      }

      const proto = getPrototype(key);
      if (!proto) {
        return { ok: false, message: `Unknown hexobject prototype: ${key}` };
      }

      const incomingWeightKg = getItemUnitWeightKg(key) * amount;
      if (!canFitAdditionalWeight(this.carriedWeightKg, this.carryCapacityKg, incomingWeightKg)) {
        console.warn('Carry limit exceeded:', incomingWeightKg, 'kg');
        return {
          ok: false,
          message: `Too heavy! Carry limit: ${this.carryCapacityKg} kg`,
        };
      }

      const meta = getMeta(key);
      const stackable = !!meta?.traits?.stackable;
      const stackKey = meta?.traits?.stackKey ?? (stackable ? key : undefined);
      const maxStack = meta?.traits?.maxStack ?? null;

      let left = amount;

      if (stackable && stackKey) {
        const stacks = this.items.filter((i) => i.stackKey === stackKey);

        for (const s of stacks) {
          if (left <= 0) break;

          if (!maxStack) {
            s.amount += left;
            s.isNew = true;
            this.rerollRotation(s.id);
            this.persist();
            return { ok: true };
          }

          const canAdd = Math.max(0, maxStack - s.amount);
          if (canAdd <= 0) continue;

          const add = Math.min(canAdd, left);
          s.amount += add;
          s.isNew = true;
          left -= add;
          this.rerollRotation(s.id);
        }

        if (left <= 0) {
          this.persist();
          return { ok: true };
        }
      }

      while (left > 0) {
        const free = this.pickFreeSlot();
        if (!free) return { ok: false, message: 'Inventory is full!' };

        const id = crypto.randomUUID();
        const addNow = !stackable || !maxStack ? left : Math.min(left, maxStack);

        const item: InventoryItem = {
          id,
          key,
          type: proto.groupType,
          stackKey: stackable ? stackKey : undefined,
          amount: stackable ? addNow : 1,
          equipSlot: undefined,
          slotKey: free,
          isNew: true,
        };

        this.items.push(item);
        this.ensureRotation(id);

        left -= addNow;

        if (!stackable) break;
      }

      this.persist();
      return { ok: true };
    },

    removeItem(id: string) {
      const idx = this.items.findIndex((i) => i.id === id);
      if (idx !== -1) this.items.splice(idx, 1);
      if (this.selectedItemId === id) this.selectedItemId = null;
      delete this.rotationsById[id];

      this.fillEmptySlotsWithHands();
      this.persist();
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
