import {defineStore} from "pinia";
import {LootItemModel} from "@/models/LootItemModel";

export const useBagStore = defineStore("bag", {
        state: () => {
            const savedBagItems = JSON.parse(localStorage.getItem("bag") || "[]");
            return {
                bagItems: savedBagItems,
                isShown: false,
                bagCapacity: 25 - savedBagItems.length,
            };
        },
        getters: {
            itemsNumber: (state): number => {return state.bagItems.length}
        },
        actions: {
            async resetBag(): Promise<void> {
                console.log('Resetting Bag state');
                this.bagItems = [];
                this.isShown = false;
                this.bagCapacity = 25;
                localStorage.removeItem("bag");
                console.log('Bag state after reset:', this.$state);
            },
            putIn(lootItem: LootItemModel) {
                if (this.bagCapacity > 0) {
                    lootItem.place = "bag";
                    this.bagItems.unshift(lootItem);
                    this.bagCapacity -= 1;
                } else {
                    console.log("Bag is full. Cannot add more items.");
                }
            },
            removeItem(lootItem: LootItemModel) {
                const itemIndex = this.bagItems.findIndex(
                    (bagItem: LootItemModel) => bagItem.id === lootItem.id
                );
                if (itemIndex !== -1) {
                    this.bagItems.splice(itemIndex, 1);
                    this.bagCapacity += 1;
                    localStorage.setItem("bag", JSON.stringify(this.bagItems));
                } else {
                    console.log("Item not found for removal");
                }
            }
        },
    })
;
