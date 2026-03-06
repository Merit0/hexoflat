import {defineStore} from "pinia";
import {THexobjectKey} from "@/registry/hexobjects-registry";
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

        // equip slots state (поки просто заглушка)
        equipped: {
            weapon: null as string | null,
            shield: null as string | null,
            armor: null as string | null,
            gloves: null as string | null,
            helm: null as string | null,
            boots: null as string | null,
        },

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
        addPickedHexobject(key: THexobjectKey, amount = 1) {
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
            this.isDragging = true;

            this.dragOffsetX = clientX - rect.left;
            this.dragOffsetY = clientY - rect.top;

            this.dragPointerX = clientX;
            this.dragPointerY = clientY;

            // важливо
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
            this.isDragging = false;
        },

        dropTo(targetSlot: string | null) {
            if (!this.isDragging || !this.draggingId || !this.dragFromSlot) {
                this.cancelDrag();
                return;
            }

            // drop outside grid => просто відміна (пізніше тут буде "drop on ground")
            if (!targetSlot) {
                this.cancelDrag();
                return;
            }

            // same slot => no-op
            if (targetSlot === this.dragFromSlot) {
                this.cancelDrag();
                return;
            }

            const fromItem = this.items.find(i => i.id === this.draggingId);
            if (!fromItem) {
                this.cancelDrag();
                return;
            }

            const targetItem = this.items.find(i => i.slotKey === targetSlot);

            // 1) target empty -> move
            if (!targetItem) {
                fromItem.slotKey = targetSlot;
                this.cancelDrag();
                return;
            }

            // 2) stack merge
            const canStack =
                !!fromItem.stackKey &&
                !!targetItem.stackKey &&
                fromItem.stackKey === targetItem.stackKey;

            if (canStack) {
                targetItem.amount += fromItem.amount;
                targetItem.isNew = true;
                // remove fromItem
                this.items = this.items.filter(i => i.id !== fromItem.id);
                this.cancelDrag();
                return;
            }

            const tmp = targetItem.slotKey;
            targetItem.slotKey = fromItem.slotKey;
            fromItem.slotKey = tmp;

            this.cancelDrag();
        }
    },
});