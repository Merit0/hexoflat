<template>
  <div class="hero-podium-container">
    <div class="podium-hero-slot">
      <div class="podium-hero-image stand-base"/>
      <div class="podium-hero-image base-hand-l breath"/>
      <div
          class="podium-hero-image breath"
          :class="{ 'base-hand-r' : !equipment.weapon }"
          :style="getItemImage(equipment.weapon)"
      />
      <div
          class="podium-hero-image"
          :class="{ 'base-boots': !equipment.boots }"
          :style="getItemImage(equipment.boots)"
      />
      <div
          class="podium-hero-image"
          :class="{ 'base-legs': !equipment.pants }"
          :style="getItemImage(equipment.pants)"
      />
      <div
          class="podium-hero-image breath"
          :class="{ 'base-armor': !equipment.armor }"
          :style="getItemImage(equipment.armor)"
      />
      <div
          class="podium-hero-image"
          :class="{ 'base-belt': !equipment.belt }"
          :style="getItemImage(equipment.belt)"
      />
      <div class="podium-hero-image base-head"/>
      <div class="podium-hero-image" v-if="equipment.helm" :style="getItemImage(equipment.helm)"/>
      <div class="podium-hero-image breath" v-if="equipment.shield" :style="getItemImage(equipment.shield)"/>
    </div>
    <hero-core-details></hero-core-details>
    <div class="podium-equipment-row podium-first-equipment-row">
      <equipment-placeholder-slot
          :equipment-item="equipment.helm"
          :empty-placeholder-image="placeholderImages.helmet"
          slot-type="helm"
      >
      </equipment-placeholder-slot>
      <equipment-placeholder-slot
          :equipment-item="equipment.armor"
          :empty-placeholder-image="placeholderImages.armor"
          slot-type="armor"
      >
      </equipment-placeholder-slot>
    </div>
    <div class="podium-equipment-row podium-second-equipment-row">
      <equipment-placeholder-slot
          :equipment-item="equipment.weapon"
          :empty-placeholder-image="placeholderImages.weapon"
          slot-type="weapon"
      >
      </equipment-placeholder-slot>
      <equipment-placeholder-slot
          :equipment-item="equipment.shield"
          :empty-placeholder-image="placeholderImages.shield"
          slot-type="shield"
      >
      </equipment-placeholder-slot>
    </div>
    <div class="podium-equipment-row podium-third-equipment-row">
      <equipment-placeholder-slot
          :equipment-item="equipment.boots"
          :empty-placeholder-image="placeholderImages.boots"
          slot-type="boots"
      >
      </equipment-placeholder-slot>
      <equipment-placeholder-slot
          :equipment-item="equipment.belt"
          :empty-placeholder-image="placeholderImages.belt"
          slot-type="gloves"
      >
      </equipment-placeholder-slot>
    </div>
    <div class="podium-equipment-row podium-fourth-equipment-row">
      <equipment-placeholder-slot
          :equipment-item="equipment.pants"
          :empty-placeholder-image="placeholderImages.pants"
          slot-type="boots"
      >
      </equipment-placeholder-slot>
      <equipment-placeholder-slot
          :equipment-item="equipment.ring"
          :empty-placeholder-image="placeholderImages.ring"
          slot-type="gloves"
      >
      </equipment-placeholder-slot>
    </div>
  </div>
</template>

<script lang="ts">
import {LootItemModel} from '@/models/LootItemModel';
import {EquipmentModel} from "@/a-game-scenes/inventory-scene/models/equipment-model";
import {PropType} from 'vue'
import EquipmentPlaceholderSlot
  from "@/a-game-scenes/inventory-scene/components/hero-equipment-holder/equipment-placeholder-slot.vue";
import HeroCoreDetails from "@/a-game-scenes/inventory-scene/components/hero-equipment-holder/hero-core-details.vue";


export default {
  name: "hero-podium",
  components: {HeroCoreDetails, EquipmentPlaceholderSlot},
  props: {
    equipment: {
      type: Object as PropType<EquipmentModel>,
      required: true
    },
  },
  data() {
    const placeholderImages: Record<string, string> = {
      helmet: 'helm-placeholder-image.png',
      armor: 'armor-placeholder-image.png',
      shield: 'shield-placeholder-image.png',
      weapon: 'sword-placeholder-image.png',
      boots: 'boots-placeholder-image.png',
      belt: 'belt-placeholder-image.png',
      pants: 'pants-placeholder-image.png',
      ring: 'ring-placeholder-image.png',
    };
    return {
      placeholderImages,
    };
  },
  methods: {
    getItemImage(equipment: LootItemModel) {
      if (!equipment?.poseImgPath) return {}
      return {
        backgroundImage: `url(${equipment.poseImgPath})`,
      };
    },
    getStyle(imagePath: string) {
      return {
        backgroundImage: `url(${imagePath})`,
      };
    },
  }
}

</script>

<style>
@import "@/a-game-scenes/inventory-scene/styles/hero-podium-style.css";
</style>