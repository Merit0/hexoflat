import {defineStore} from "pinia";
import {HEXOBJECT_KEYS, THexobjectKey} from "@/registry/hexobjects-registry";
import {EHexobjectGroup} from "@/abstraction/hexobject-abstraction";
import {HEX_OBJECT_PROTOTYPES} from "@/registry/hexobjects/prototypes";
import {HEXOBJECT_META} from "@/registry/hexobject-meta";

export type TEquipSlot =
    | "weapon"
    | "shield"
    | "armor"
    | "gloves"
    | "helm"
    | "boots";

export interface InventoryItem {
    id: string;
    key: THexobjectKey;
    type: EHexobjectGroup;

    stackKey?: string; // usually key, if stackable
    amount: number;

    equipSlot?: TEquipSlot;

    slotKey: string;
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

function equipSlotKey(slot: TEquipSlot) {
    return `eq:${slot}`;
}

function parseEquipSlotKey(value: string | null | undefined): TEquipSlot | null {
    if (!value) return null;
    if (!value.startsWith("eq:")) return null;

    const slot = value.slice(3) as TEquipSlot;

    if (
        slot === "weapon" ||
        slot === "shield" ||
        slot === "armor" ||
        slot === "gloves" ||
        slot === "helm" ||
        slot === "boots"
    ) {
        return slot;
    }

    return null;
}

function isBlocked(r: number, c: number, cfg: GridConfig) {
    const {x, y, w, h} = cfg.blockedRect;
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
            blockedRect: {x: 3, y: 1, w: 6, h: 5},
        } as GridConfig,

        items: [] as InventoryItem[],
        selectedItemId: null as string | null,

        // UI-only stable rotation map
        rotationsById: {} as Record<string, number>,

        carryCapacityKg: 5,
        draggingId: null as string | null,
        dragFromSlot: null as string | null,
        dragOverSlot: null as string | null,
        isDragging: false,
        dragPointerX: 0,
        dragPointerY: 0,
        dragOffsetX: 0,
        dragOffsetY: 0,
        dragWidth: 0,
        dragHeight: 0,

        dragOverEquipSlot: null as TEquipSlot | null,
    }),

    getters: {
        equippedItems(state): Record<TEquipSlot, InventoryItem | null> {
            return {
                weapon: state.items.find(i => i.slotKey === equipSlotKey("weapon")) ?? null,
                shield: state.items.find(i => i.slotKey === equipSlotKey("shield")) ?? null,
                armor: state.items.find(i => i.slotKey === equipSlotKey("armor")) ?? null,
                gloves: state.items.find(i => i.slotKey === equipSlotKey("gloves")) ?? null,
                helm: state.items.find(i => i.slotKey === equipSlotKey("helm")) ?? null,
                boots: state.items.find(i => i.slotKey === equipSlotKey("boots")) ?? null,
            };
        },

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
        setDragOverEquip(slot: TEquipSlot | null) {
            this.dragOverEquipSlot = slot;
        },

        moveItemToSlot(itemId: string, targetSlotKey: string) {
            const fromItem = this.items.find(i => i.id === itemId);
            if (!fromItem) return;

            if (fromItem.slotKey === targetSlotKey) return;

            // HAND не можна переносити у grid
            if (fromItem.key === HEXOBJECT_KEYS.HAND) {
                const targetEquip = parseEquipSlotKey(targetSlotKey);

                if (targetEquip !== "weapon" && targetEquip !== "shield") {
                    return;
                }
            }

            const targetItem = this.items.find(i => i.slotKey === targetSlotKey);

            // якщо слот містить HAND і кладемо інший предмет
            if (
                targetItem &&
                targetItem.key === HEXOBJECT_KEYS.HAND &&
                fromItem.key !== HEXOBJECT_KEYS.HAND
            ) {
                const idx = this.items.findIndex(i => i.id === targetItem.id);
                if (idx !== -1) this.items.splice(idx, 1);

                fromItem.slotKey = targetSlotKey;

                this.ensureDefaultHands();
                return;
            }

            if (!targetItem) {
                fromItem.slotKey = targetSlotKey;

                this.ensureDefaultHands();
                return;
            }

            const targetEquip = parseEquipSlotKey(targetSlotKey);

            if (!targetEquip) {
                const merged = this.mergeStacks(targetItem, fromItem);

                if (merged) {
                    targetItem.isNew = true;

                    if (fromItem.amount <= 0) {
                        const idx = this.items.findIndex(i => i.id === fromItem.id);
                        if (idx !== -1) this.items.splice(idx, 1);
                    }

                    this.ensureDefaultHands();
                    return;
                }
            }

            const oldSlot = fromItem.slotKey;
            fromItem.slotKey = targetSlotKey;
            targetItem.slotKey = oldSlot;

            this.ensureDefaultHands();
        },

        dropToEquip(targetEquipSlot: TEquipSlot | null) {
            if (!this.isDragging || !this.draggingId || !targetEquipSlot) {
                this.cancelDrag();
                return;
            }

            this.moveItemToSlot(this.draggingId, equipSlotKey(targetEquipSlot));
            this.cancelDrag();
        },

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
        pickupFromWorld(key: THexobjectKey, amount = 1) {
            const proto = HEX_OBJECT_PROTOTYPES[key];
            const meta = HEXOBJECT_META[key];

            const stackable = !!meta?.traits?.stackable;
            const stackKey = meta?.traits?.stackKey ?? (stackable ? key : undefined);
            const maxStack = meta?.traits?.maxStack ?? null; // null/undefined => unlimited

            let left = amount;

            if (stackable && stackKey) {
                // 1) fill existing stacks first
                const stacks = this.items.filter(i => i.stackKey === stackKey);

                for (const s of stacks) {
                    if (left <= 0) break;

                    if (!maxStack) {
                        s.amount += left;
                        s.isNew = true;
                        return {ok: true};
                    }

                    const canAdd = Math.max(0, maxStack - s.amount);
                    if (canAdd <= 0) continue;

                    const add = Math.min(canAdd, left);
                    s.amount += add;
                    s.isNew = true;
                    left -= add;
                }
            }

            // 2) create new stacks in free slots
            while (left > 0) {
                const free = this.pickFreeSlot();
                if (!free) return {ok: false, message: "Inventory is full!"};

                const id = crypto.randomUUID();

                const addNow = (!stackable || !maxStack) ? left : Math.min(left, maxStack);

                const item: InventoryItem = {
                    id,
                    key,
                    type: proto.groupType, // або resolveInventoryView().group
                    stackKey: stackable ? stackKey : undefined,
                    amount: stackable ? addNow : 1,
                    equipSlot: undefined, // якщо треба — резолвиш як зараз
                    slotKey: free,
                    isNew: true,
                };

                this.items.push(item);
                this.ensureRotation(id);

                left -= addNow;

                // якщо не stackable — ми додали 1 штуку і виходимо
                if (!stackable) break;
            }

            return {ok: true};
        },

        // utility на майбутнє (кнопка debug у дев-режимі)
        removeItem(id: string) {
            const idx = this.items.findIndex(i => i.id === id);
            if (idx !== -1) this.items.splice(idx, 1);
            if (this.selectedItemId === id) this.selectedItemId = null;
            delete this.rotationsById[id];
        },

        startDrag(itemId: string, clientX: number, clientY: number, rect: DOMRect) {
            const item = this.items.find(i => i.id === itemId);
            if (!item) return;

            this.draggingId = itemId;
            this.dragFromSlot = item.slotKey;
            this.dragOverSlot = null;
            this.dragOverEquipSlot = null;
            this.isDragging = true;

            this.dragOffsetX = clientX - rect.left;
            this.dragOffsetY = clientY - rect.top;

            this.dragPointerX = clientX;
            this.dragPointerY = clientY;

            this.dragWidth = rect.width;
            this.dragHeight = rect.height;
        },

        updateDragPointer(clientX: number, clientY: number) {
            this.dragPointerX = clientX;
            this.dragPointerY = clientY;
        },

        setDragOver(slotKey: string | null) {
            this.dragOverSlot = slotKey;
        },

        cancelDrag() {
            this.draggingId = null;
            this.dragFromSlot = null;
            this.dragOverSlot = null;
            this.dragOverEquipSlot = null;
            this.isDragging = false;

            this.dragPointerX = 0;
            this.dragPointerY = 0;
            this.dragOffsetX = 0;
            this.dragOffsetY = 0;
            this.dragWidth = 0;
            this.dragHeight = 0;
        },

        mergeStacks(target: InventoryItem, from: InventoryItem): boolean {
            if (!target.stackKey || !from.stackKey) return false;
            if (target.stackKey !== from.stackKey) return false;

            const meta = HEXOBJECT_META[from.key];
            const maxStack = meta?.traits?.maxStack ?? null;

            // unlimited stack
            if (!maxStack) {
                target.amount += from.amount;
                return true;
            }

            const canAdd = Math.max(0, maxStack - target.amount);
            if (canAdd <= 0) return false;

            const add = Math.min(canAdd, from.amount);

            target.amount += add;
            from.amount -= add;

            return true;
        },

        dropTo(targetSlot: string | null) {
            if (!this.isDragging || !this.draggingId || !this.dragFromSlot) {
                this.cancelDrag();
                return;
            }

            if (!targetSlot || targetSlot === this.dragFromSlot) {
                this.cancelDrag();
                return;
            }

            this.moveItemToSlot(this.draggingId, targetSlot);
            this.cancelDrag();
        },

        ensureDefaultHands() {
            const hasWeaponHand = this.items.some(i => i.slotKey === "eq:weapon");
            const hasShieldHand = this.items.some(i => i.slotKey === "eq:shield");

            if (!hasWeaponHand) {
                this.items.push({
                    id: crypto.randomUUID(),
                    key: HEXOBJECT_KEYS.HAND,
                    type: EHexobjectGroup.TOOL,
                    amount: 1,
                    slotKey: "eq:weapon",
                    isNew: false,
                });
            }

            if (!hasShieldHand) {
                this.items.push({
                    id: crypto.randomUUID(),
                    key: HEXOBJECT_KEYS.HAND,
                    type: EHexobjectGroup.TOOL,
                    amount: 1,
                    slotKey: "eq:shield",
                    isNew: false,
                });
            }
        },
    },
});