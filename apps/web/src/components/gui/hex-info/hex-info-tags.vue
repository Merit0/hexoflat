<template>
  <ul v-if="tags.length" class="tags" :class="{ 'is-center': center }">
    <li v-for="chip in tags" :key="chip.id" class="tag" :class="`is-${chip.tone}`">
      {{ chip.label }}
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { HexInfoTag } from '@/services/hex-info/build-hex-info';

defineProps<{ tags: HexInfoTag[]; center?: boolean }>();
</script>

<style scoped>
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tags.is-center {
  justify-content: center;
}
.tag {
  padding: 3px 14px;
  border: 1px solid #b98a43;
  background: rgba(185, 138, 67, 0.14);
  clip-path: polygon(
    10px 0,
    calc(100% - 10px) 0,
    100% 50%,
    calc(100% - 10px) 100%,
    10px 100%,
    0 50%
  );
  color: #eadfc6;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.tag.is-danger {
  color: #f08a7a;
  border-color: rgba(240, 138, 122, 0.5);
  background: rgba(240, 138, 122, 0.1);
}
.tag.is-warn {
  color: #e8b865;
  border-color: rgba(232, 184, 101, 0.5);
  background: rgba(232, 184, 101, 0.1);
}
.tag.is-good {
  color: #7bd88f;
  border-color: rgba(123, 216, 143, 0.5);
  background: rgba(123, 216, 143, 0.1);
}
</style>
