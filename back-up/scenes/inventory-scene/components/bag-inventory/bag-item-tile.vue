<template>
  <div class="inventorySlotContainer">
    <div
        v-if="verifyItemPower(lootItem)"
        class="powerIdentifier"
    ></div>
    <div
        class="bagItemImg"
        :class="{ 'is-busy': animating || !isEquipment(lootItem) }"
        :style="getItemStyle(lootItem)"
        @click="!animating && animateEquip(lootItem)"
        :ref="'item-' + lootItem.id"
    ></div>
    <div class="inventoryFrameImage"></div>
  </div>
</template>

<script lang="ts">
import {ItemType} from '@/enums/ItemType';
import {LootItemModel} from '@/models/LootItemModel';
import {useBagStore} from '@stores/bag-store';
import {useHeroStore} from '@stores/hero-store';
import {PropType} from 'vue';
import {EquipmentModel} from "@/a-game-scenes/inventory-scene/models/equipment-model";

export default {
  name: "BagItemTile",
  props: {
    lootItem: {
      type: Object as PropType<LootItemModel>,
      required: true
    }
  },
  data() {
    const bagStore = useBagStore();
    const heroStore = useHeroStore();
    return {
      bagStore,
      hero: heroStore.hero,
      animating: false,
    };
  },
  methods: {
    getItemStyle(lootItem: LootItemModel) {
      return {
        backgroundImage: `url(${lootItem.imgPath})`,
      };
    },

    async animateEquip(item: LootItemModel) {
      if (this.animating) return;
      this.animating = true;

      try {
        const itemEl = this.$refs['item-' + item.id] as HTMLElement;
        const heroImageEl = document.querySelector('.equipment-holder-hero-image') as HTMLElement;
        const itemRect = itemEl.getBoundingClientRect();
        const heroRect = heroImageEl.getBoundingClientRect();

        const clone = itemEl.cloneNode(true) as HTMLElement;
        document.body.appendChild(clone);

        Object.assign(clone.style, {
          position: 'fixed',
          top: itemRect.top + 'px',
          left: itemRect.left + 'px',
          width: itemRect.width + 'px',
          height: itemRect.height + 'px',
          transition: 'all 0.3s ease-in-out',
          zIndex: '1000',
          pointerEvents: 'none'
        });

        requestAnimationFrame(() => {
          Object.assign(clone.style, {
            top: heroRect.top + heroRect.height / 2 - itemRect.height / 2 + 'px',
            left: heroRect.left + heroRect.width / 2 - itemRect.width / 2 + 'px',
            transform: 'scale(1.2)',
            opacity: '0.7'
          });

          setTimeout(() => {
            if (item.itemType === ItemType.HEAL) {
              clone.style.transition = 'opacity 0.2s ease-in';
              clone.style.opacity = '0';
              setTimeout(() => {
                document.body.removeChild(clone);
                this.useItem(item);
                this.animating = false;
              }, 200);
            } else {
              const slotKey = ItemType[item.itemType].toLowerCase();
              const slotEl = document.querySelector(`.equipment-slot[data-slot="${slotKey}"]`) as HTMLElement;

              if (!slotEl) {
                document.body.removeChild(clone);
                this.useItem(item);
                this.animating = false;
                return;
              }

              const slotRect = slotEl.getBoundingClientRect();

              clone.style.transition = 'top 0.3s, left 0.3s, transform 0.3s, opacity 0.3s';
              Object.assign(clone.style, {
                top: slotRect.top + 'px',
                left: slotRect.left + 'px',
                width: slotRect.width + 'px',
                height: slotRect.height + 'px',
                opacity: '0.4',
                transform: 'scale(1.0)',
              });

              setTimeout(() => {
                document.body.removeChild(clone);
                this.useItem(item);
                this.animating = false; // знімаємо лок
              }, 400);
            }
          }, 300);
        });
      } catch (e) {
        this.animating = false;
        console.error(e);
      }
    },

    useItem(item: LootItemModel) {
      const bag = this.bagStore;
      const hero = this.hero;

      const equip = (slotKey: keyof typeof hero.equipment, statKey: keyof typeof hero) => {
        if (hero.equipment[slotKey]) {
          bag.removeItem(item);
          hero[statKey] -= hero?.equipment[slotKey]?.value;
          bag.putIn(hero.equipment[slotKey]);
        } else {
          bag.removeItem(item);
        }
        hero.equipment[slotKey] = item;
        hero[statKey] += item.value;
      };

      switch (item.itemType) {
        case ItemType.WEAPON:
          equip('weapon', 'attack');
          break;
        case ItemType.ARMOR:
          equip('armor', 'maxHealth');
          break;
        case ItemType.HELM:
          equip('helm', 'maxHealth');
          break;
        case ItemType.SHIELD:
          equip('shield', 'maxHealth');
          break;
        case ItemType.BOOTS:
          equip('boots', 'maxHealth');
          break;
        case ItemType.PANTS:
          equip('pants', 'maxHealth');
          break;
        case ItemType.BELT:
          equip('belt', 'maxHealth');
          break;
        case ItemType.HEAL:
          hero.currentHealth = Math.min(hero.currentHealth + item.value, hero.maxHealth);
          bag.removeItem(item);
          break;
      }
    },

    verifyItemPower(item: LootItemModel): boolean {
      const hero = this.hero;
      const slot = EquipmentModel.slotMap[item.itemType];
      if (!slot) return false;
      const equipped = hero.equipment[slot];
      return equipped ? equipped.value < item.value : true;
    },

    isEquipment(item: LootItemModel): boolean {
      return (!(item.itemType === ItemType.SKIN || item.itemType === ItemType.KEY))
    }
  }
};
</script>

<style>
.bagItemImg {
  position: relative;
  width: 80%;
  height: 80%;
  border-radius: 10%;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  z-index: 1;
}

.bagItemImg:active {
  transform: scale(0.95);
  filter: brightness(1.2);
}

.bagItemImg:hover {
  box-shadow: 0 0 10px rgba(255, 204, 69, 0.6);
  transform: scale(1.05);
  cursor: pointer;
}

.bagItemImg.is-busy {
  pointer-events: none;
  opacity: 0.8;
  transform: none !important;
  box-shadow: none !important;
}

.powerIdentifier {
  position: absolute;
  bottom: 2%;
  right: -2%;
  width: 30%;
  height: 30%;
  background-image: url("@/a-game-scenes/inventory-scene/assets/green-arrow-up-image.png");
  background-size: cover;
  border-radius: 10%;
  z-index: 1;
  animation: floatUpDown 1.5s ease-in-out infinite;
}

@keyframes floatUpDown {
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10%);
  }
  100% {
    transform: translateY(0);
  }
}
</style>