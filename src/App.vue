<template>
  <body>
  <main>
    <div>
      <router-view/>
    </div>
  </main>
  </body>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: "App",
});
</script>
