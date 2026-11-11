<template>
  <span
    class="tag"
    :class="{ 'is-short': !affordable }"
    :data-testid="testid"
    :data-price="price"
    :data-affordable="affordable"
  >
    <img :src="COIN_SRC" alt="" aria-hidden="true" />
    <span>{{ price }}</span>
  </span>
</template>

<script setup lang="ts">
import { getPrototype } from '@hexoflat/engine';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';

const COIN_SRC = getPrototype(HEXOBJECT_KEYS.COINS).spritePath ?? '';

defineProps<{ price: number; affordable: boolean; testid: string }>();
</script>

<style scoped>
.tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
  color: #ffe98a;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.tag img {
  width: 14px;
  height: 14px;
  object-fit: contain;
  flex: none;
}
.tag.is-short {
  color: #ff9d9d;
}
</style>
