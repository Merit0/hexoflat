<template>
  <div class="equipment-slot" :data-slot="slotType">
    <div class="slot-background-image"></div>
    <div
        v-if="equipmentItem == null"
        class="emptySlotImgContainer"
    >
      <div
          class="emptySlotImg"
          :style="getEmptyPlaceholderImage(emptyPlaceholderImage)"
      >
      </div>
    </div>
    <div
        v-if="equipmentItem != null"
        class="itemBackgroundImage"
        :style="getItemBackgroundColorByRarity(equipmentItem.rarity)"
    >
      <div
          class="equipmentItemImg"
          :style="equipmentItemStyles"
          @click="takeOffEquipment(equipmentItem)"
      >
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {useBagStore} from '@stores/bag-store';
import {useHeroStore} from '@stores/hero-store';
import {LootItemModel} from '@/models/LootItemModel';
import {Rarity} from '@/enums/Rarity';
import {ItemType} from '@/enums/ItemType';

export default defineComponent({
  name: 'equipment-placeholder-slot',
  props: {
    equipmentItem: {
      type: Object as PropType<LootItemModel | null>,
      default: null,
    },
    emptyPlaceholderImage: {
      type: String,
      required: true,
    },
    moveImageMoveRight: {
      type: String,
      required: false,
    },
    slotType: {
      type: String,
      required: true
    },
  },
  data() {
    const bagStore = useBagStore();
    const heroStore = useHeroStore();
    const hero = heroStore.hero;
    return {
      bagStore,
      hero
    };
  },
  computed: {
    equipmentItemStyles(): object {
      return {
        ...this.getItemImage(this.equipmentItem),
        ...this.moveItemImage(this.moveImageMoveRight),
      };
    },
  },
  methods: {
    getItemImage(lootItem: LootItemModel) {
      return {
        backgroundImage: `url(${lootItem.imgPath})`,
      };
    },
    moveItemImage(toLeft: string) {
      return {
        marginLeft: toLeft,
      };
    },
    getEmptyPlaceholderImage(placeholderSlotImage: string) {
      return {
        backgroundImage: `url(/src/a-game-scenes/inventory-scene/assets/equipment-placeholder-slots/${placeholderSlotImage})`,
      };
    },
    getItemBackgroundColorByRarity(itemRarity: Rarity) {
      const gradients: Record<Rarity, { background: string }> = {
        [Rarity.LEGEND]: {
          background: `radial-gradient(circle at center, rgba(203, 149, 255, 0.7) 0%, rgba(207, 159, 255, 0.4) 40%, rgba(164, 71, 255, 0.2) 70%, transparent 100%)`,
        },
        [Rarity.MYTHIC]: {
          background: `radial-gradient(circle at center, rgba(185, 50, 100, 0.7) 0%, rgba(144, 40, 115, 0.45) 40%, rgba(90, 20, 90, 0.25) 70%, transparent 100%)`,
        },
        [Rarity.RARE]: {
          background: `radial-gradient(circle at center, rgba(123, 88, 255, 0.7) 0%, rgba(98, 62, 219, 0.5) 40%, rgba(54, 34, 129, 0.3) 70%, transparent 100%)`,
        },
        [Rarity.COMMON]: {
          background: `radial-gradient(circle at center, rgba(144, 255, 184, 0.7) 0%, rgba(121, 243, 171, 0.4) 40%, rgba(0, 193, 93, 0.2) 70%, transparent 100%)`,
        },
      };
      return gradients[itemRarity] || gradients[Rarity.COMMON];
    },
    async takeOffEquipment(item: LootItemModel) {
      if (!item) return;

      const equipment = this.hero.equipment;
      const itemType = item.itemType;

      if (itemType === ItemType.WEAPON && equipment.weapon) {
        await this.bagStore.putIn(item);
        this.hero.attack -= equipment.weapon.value;
        equipment.weapon = null;
      } else if (itemType === ItemType.ARMOR && equipment.armor) {
        await this.bagStore.putIn(item);
        this.hero.maxHealth -= equipment.armor.value;
        equipment.armor = null;
      } else if (itemType === ItemType.HELM && equipment.helm) {
        await this.bagStore.putIn(item);
        this.hero.maxHealth -= equipment.helm.value;
        equipment.helm = null;
      } else if (itemType === ItemType.SHIELD && equipment.shield) {
        await this.bagStore.putIn(item);
        this.hero.maxHealth -= equipment.shield.value;
        equipment.shield = null;
      } else if (itemType === ItemType.BOOTS && equipment.boots) {
        await this.bagStore.putIn(item);
        this.hero.maxHealth -= equipment.boots.value;
        equipment.boots = null;
      } else if (itemType === ItemType.PANTS && equipment.pants) {
        await this.bagStore.putIn(item);
        this.hero.maxHealth -= equipment.pants.value;
        equipment.pants = null;
      } else if (itemType === ItemType.BELT && equipment.belt) {
        await this.bagStore.putIn(item);
        this.hero.maxHealth -= equipment.belt.value;
        equipment.belt = null;
      }

      this.hero.adjustHealthOnStatChange();
    }
  },
});
</script>

<style scoped>
@import "@/a-game-scenes/inventory-scene/styles/equipment-placeholder-slot-style.css";
</style>