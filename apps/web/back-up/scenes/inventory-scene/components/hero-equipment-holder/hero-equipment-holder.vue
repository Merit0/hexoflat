<template>
  <div class="hero-equipment-container">
    <div class="hero-slot">
      <div class="equipment-holder-hero-image stand-base"/>
      <div class="equipment-holder-hero-image base-hand-l  breath"/>
      <div
          class="equipment-holder-hero-image breath"
          :class="{ 'base-hand-r' : !equipment.weapon }"
          :style="getPoseItemImage(equipment.weapon)"
      />
      <div
          class="equipment-holder-hero-image"
          :class="{ 'base-boots': !equipment.boots }"
          :style="getPoseItemImage(equipment.boots)"
      />
      <div
          class="equipment-holder-hero-image"
          :class="{ 'base-legs': !equipment.pants }"
          :style="getPoseItemImage(equipment.pants)"
      />
      <div
          class="equipment-holder-hero-image breath"
          :class="{ 'base-armor': !equipment.armor }"
          :style="getPoseItemImage(equipment.armor)"
      />
      <div
          class="equipment-holder-hero-image"
          :class="{ 'base-belt': !equipment.belt }"
          :style="getPoseItemImage(equipment.belt)"
      />
      <div class="equipment-holder-hero-image base-head"/>
      <div class="equipment-holder-hero-image" v-if="equipment.helm" :style="getPoseItemImage(equipment.helm)"/>
      <div class="equipment-holder-hero-image breath" v-if="equipment.shield" :style="getPoseItemImage(equipment.shield)"/>
    </div>
    <hero-core-details></hero-core-details>
    <div class="equipment-row first-equipment-row">
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
    <div class="equipment-row second-equipment-row">
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
    <div class="equipment-row third-equipment-row">
      <equipment-placeholder-slot
          :equipment-item="equipment.boots"
          :empty-placeholder-image="placeholderImages.boots"
          slot-type="boots"
      >
      </equipment-placeholder-slot>
      <equipment-placeholder-slot
          :equipment-item="equipment.belt"
          :empty-placeholder-image="placeholderImages.belt"
          slot-type="belt"
      >
      </equipment-placeholder-slot>
    </div>
    <div class="equipment-row fourth-equipment-row">
      <equipment-placeholder-slot
          :equipment-item="equipment.pants"
          :empty-placeholder-image="placeholderImages.pants"
          slot-type="pants"
      >
      </equipment-placeholder-slot>
      <equipment-placeholder-slot
          :equipment-item="equipment.ring"
          :empty-placeholder-image="placeholderImages.ring"
          slot-type="ring"
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
  name: "hero-equipment-holder",
  components: {HeroCoreDetails, EquipmentPlaceholderSlot},
  props: {
    equipment: {
      type: Object as PropType<EquipmentModel>,
      required: true
    }
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
    getPoseItemImage(equipment: LootItemModel) {
      if (!equipment?.poseImgPath) return {}
      return {
        backgroundImage: `url(${equipment.poseImgPath}-pose.png)`,
      };
    },
  }
}

</script>

<style>
@import "@/a-game-scenes/inventory-scene/styles/hero-equipment-holder-style.css";
</style>