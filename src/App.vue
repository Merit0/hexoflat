<template>
  <body>
  <main>
    <div>
      <router-view/>
      <base-overlay />
    </div>
  </main>
  </body>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import BaseOverlay from "@/components/base-overlay.vue";

export default defineComponent({
  name: "App",
  components: {BaseOverlay},
});
</script>
