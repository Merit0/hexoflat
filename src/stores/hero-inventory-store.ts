import { defineStore } from "pinia";
import { resolveItemTraits } from "@/utils/inventory/traits-resolver";

export type TInventoryItemType = "resource" | "loot" | "tool" | "equipment";

export type TEquipSlot =
    | "weapon"
    | "shield"
    | "armor"
    | "gloves"
    | "helm"
    | "boots";

export interface InventoryItem {
    id: string;
    key: string; // HEXOBJECT_KEYS.*
    type: TInventoryItemType;

    stackKey?: string; // usually key, if stackable
    amount: number;

    equipSlot?: TEquipSlot;

    slotKey: string; // "r3c10"
    isNew: boolean;
}

export interface GridConfig {
    cols: number;
    rows: number;
    blockedRect: { x: number; y: number; w: number; h: number }; // 0-based
}

function slotKey(r: number, c: number) {
    return `r${r}c${c}`;
}

function isBlocked(r: number, c: number, cfg: GridConfig) {
    const { x, y, w, h } = cfg.blockedRect;
    return c >= x && c < x + w && r >= y && r < y + h;
}

function hashRotationDeg(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return (h % 31) - 15; // [-15..+15]
}

export const useHeroInventoryStore = defineStore("heroInventory", {
    state: () => ({
        grid: {
            cols: 12,
            rows: 7,
            blockedRect: { x: 3, y: 1, w: 6, h: 5 },
        } as GridConfig,

        items: [] as InventoryItem[],
        selectedItemId: null as string | null,

        // UI-only stable rotation map
        rotationsById: {} as Record<string, number>,

        // equip slots state (поки просто заглушка)
        equipped: {
            weapon: null as string | null,
            shield: null as string | null,
            armor: null as string | null,
            gloves: null as string | null,
            helm: null as string | null,
            boots: null as string | null,
        },

        // на майбутнє вантажність
        carryCapacityKg: 5,
    }),

    getters: {
        selectedItem(state): InventoryItem | null {
            return state.items.find(i => i.id === state.selectedItemId) ?? null;
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
            const occ = new Set(state.items.map(i => i.slotKey));
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
    },

    actions: {
        isCellBlocked(r: number, c: number) {
            return isBlocked(r, c, this.grid);
        },

        ensureRotation(id: string) {
            if (this.rotationsById[id] == null) this.rotationsById[id] = hashRotationDeg(id);
            return this.rotationsById[id];
        },

        toggleSelect(id: string) {
            this.selectedItemId = this.selectedItemId === id ? null : id;
            const it = this.items.find(x => x.id === id);
            if (it) it.isNew = false;
        },

        clearSelection() {
            this.selectedItemId = null;
        },

        pickFreeSlot(): string | null {
            const slots = this.freeSlotKeys;
            if (!slots.length) return null;
            const idx = Math.floor(Math.random() * slots.length);
            return slots[idx];
        },

        /**
         * Викликається коли герой підняв об'єкт з мапи.
         * key = HEXOBJECT_KEYS.*
         */
        addPickedHexobject(key: string, amount = 1) {
            const meta = resolveItemTraits(key);
            const stackable = !!meta.stackable;

            // (пізніше) вантажність:
            // const predicted = this.totalWeightKg + meta.weightKg * amount; if (predicted > this.carryCapacityKg) ...

            if (stackable) {
                const stackKey = meta.stackKey ?? key;
                const existing = this.items.find(i => i.stackKey === stackKey);
                if (existing) {
                    existing.amount += amount;
                    existing.isNew = true;
                    return { ok: true };
                }
            }

            const free = this.pickFreeSlot();
            if (!free) return { ok: false, message: "Inventory is full!" };

            const id = crypto.randomUUID();
            const item: InventoryItem = {
                id,
                key,
                type: meta.type,
                stackKey: stackable ? (meta.stackKey ?? key) : undefined,
                amount: stackable ? amount : 1,
                equipSlot: meta.equipSlot,
                slotKey: free,
                isNew: true,
            };

            this.items.push(item);
            this.ensureRotation(id);
            return { ok: true };
        },

        // utility на майбутнє (кнопка debug у дев-режимі)
        removeItem(id: string) {
            const idx = this.items.findIndex(i => i.id === id);
            if (idx !== -1) this.items.splice(idx, 1);
            if (this.selectedItemId === id) this.selectedItemId = null;
            delete this.rotationsById[id];
        },
    },
});