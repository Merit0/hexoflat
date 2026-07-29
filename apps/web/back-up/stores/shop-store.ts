import {defineStore} from 'pinia';
import {LootItemModel} from '@/models/LootItemModel';
import {ElixirsProvider} from "@/providers/elixir-provider";
import {HelmetProvider} from "@/providers/helmet-provider";
import {ArmorProvider} from "@/providers/armor-provider";
import {ShieldProvider} from "@/providers/shield-provider";
import {BootsProvider} from "@/providers/boots-provider";
import {PantsProvider} from "@/providers/equipment-provider/pants-provider";
import {BeltsProvider} from "@/providers/equipment-provider/belts-provider";
import {DungeonKeyProvider} from "@/providers/dungeon-key-provider";

export const useShopStore = defineStore('shop', {
    state: () => ({
        items: [] as LootItemModel[],
    }),

    actions: {
        initShopItems(): void {
            const purchasedIds: string[] = JSON.parse(localStorage.getItem("purchasedItems") || "[]");

            let parsedShopItems: LootItemModel[] | null = null;

            try {
                const raw = localStorage.getItem("shop");
                const parsed = raw ? JSON.parse(raw) : null;
                parsedShopItems = parsed?.items ?? null;
            } catch (e) {
                console.warn("Failed to parse shop items from storage:", e);
                parsedShopItems = null;
            }

            const initialItems = this.generateInitialItems();

            const baseItems = parsedShopItems ?? initialItems;

            this.items = baseItems.map((item: LootItemModel) => ({
                ...item,
                place: purchasedIds.includes(item.id) ? "bag" : "shop"
            }));

            if (!parsedShopItems) {
                localStorage.setItem("shop", JSON.stringify({items: this.items}));
            }
        },

        refreshShopItems(): void {
            this.items = [];
            const newItems = this.generateInitialItems().sort(() => Math.random() - 0.5);

            this.items = newItems.map((item: LootItemModel) => ({
                ...item,
                place: "shop"
            }));

            localStorage.setItem("shop", JSON.stringify({items: this.items}));

            console.log("Shop has been refreshed!");
        },

        generateInitialItems(): LootItemModel[] {
            return [
                HelmetProvider.getIronHat(),
                ArmorProvider.getLeatherArmor(),
                BeltsProvider.getLeatherBelt(),
                PantsProvider.getElfPants(),
                BootsProvider.getLeatherBoots(),
                DungeonKeyProvider.getGoldenKey(),
                ShieldProvider.getRoundWoodenShield(),
                ElixirsProvider.getCommonElixir(),
                // WeaponProvider.getMolner(),
            ];
        },
    },
});
