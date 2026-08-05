<template>
  <div>
    <div>
      <div>
        <router-view />
        <base-overlay />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import BaseOverlay from '@/components/base-overlay.vue';

export default defineComponent({
  name: 'App',
  components: { BaseOverlay },
});
</script>
